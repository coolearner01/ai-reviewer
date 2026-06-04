import { prisma } from '../../../infrastructure/database/client';
import { aiHealth } from '../../../infrastructure/ai/aiClient';
import { orchestrator } from '../../../agents/orchestrator';
import { holisticReviewAgent, type HolisticReviewResult } from '../../../agents/holisticReviewAgent';
import { resolveProviderFor } from '../../providers/providerResolver';
import { reviewService } from '../reviewService';
import { pullRequestService } from '../pullRequestService';
import { prDetailService } from '../prDetailService';
import { logger } from '../../../utils/logger';
import { applyContextBudget } from '../../../utils/contextBudget';
import type { Finding, MergeRecommendation, ReviewContext } from '../../../types';
import type { Fetched, PipelineState } from './types';
import {
  buildExecutiveSummary,
  deploymentRiskFromScore,
  isIgnored,
} from './helpers';

async function resolveProvider(state: PipelineState) {
  return resolveProviderFor({
    organizationId: state.organizationId,
    provider: state.provider,
    logContext: '[pipeline]',
  });
}

export async function step1Fetch(state: PipelineState): Promise<Fetched> {
  await reviewService.updateStatus({
    reviewId: state.reviewId,
    status: 'fetching',
    message: 'Fetching PR diff and file contents…',
    progress: 10,
  });

  const provider = await resolveProvider(state);

  const [metadata, diff, changedFiles] = await Promise.all([
    provider.fetchPRMetadata(state.prUrl),
    provider.fetchDiff(state.prUrl),
    provider.fetchChangedFiles(state.prUrl),
  ]);

  await prisma.review.update({
    where: { id: state.reviewId },
    data: { diffCached: diff },
  });

  const repoRow = await prisma.repository.findUnique({
    where: { repoUrl: state.repoUrl },
    select: { id: true },
  });
  let pullRequestId: string | null = null;
  if (repoRow) {
    const pr = await pullRequestService.upsert({
      repositoryId: repoRow.id,
      prUrl: state.prUrl,
      metadata,
    });
    pullRequestId = pr.id;

    await prDetailService.appendEvent({
      pullRequestId: pr.id,
      eventType: 'ai_review_started',
      actor: 'reviewbot',
      payload: { reviewId: state.reviewId },
    });

    await Promise.all([
      provider.fetchCommits
        ? provider
            .fetchCommits(state.prUrl)
            .then((commits) =>
              commits.length > 0 ? prDetailService.replaceCommits(pr.id, commits) : undefined,
            )
            .catch((err: Error) =>
              logger.warn('[pipeline] fetchCommits failed', { error: err.message }),
            )
        : Promise.resolve(),
      provider.fetchChecks
        ? provider
            .fetchChecks(state.prUrl)
            .then((checks) =>
              checks.length > 0 ? prDetailService.replaceChecks(pr.id, checks) : undefined,
            )
            .catch((err: Error) =>
              logger.warn('[pipeline] fetchChecks failed', { error: err.message }),
            )
        : Promise.resolve(),
    ]);
  }
  state.pullRequestId = pullRequestId ?? undefined;

  const filtered = changedFiles.filter((f) => !isIgnored(f, state.ignoredPaths));
  const fileContents: Record<string, string> = {};
  await Promise.all(
    filtered.map(async (file) => {
      const content = await provider.fetchFileContent(state.repoUrl, file, metadata.sourceBranch);
      if (content && content.length < 200_000) {
        fileContents[file] = content;
      }
    }),
  );

  return { metadata, diff, changedFiles: filtered, fileContents };
}

export async function step2Analyze(state: PipelineState, fetched: Fetched) {
  await reviewService.updateStatus({
    reviewId: state.reviewId,
    status: 'analyzing',
    message: 'Running AI review agents…',
    progress: 30,
  });

  const ctx: ReviewContext = {
    ...applyContextBudget({
      diff: fetched.diff,
      changedFiles: fetched.changedFiles,
      fileContents: fetched.fileContents,
    }),
    prMeta: { ...fetched.metadata, repoUrl: state.repoUrl },
    customPrompt: state.customPrompt,
    reviewDepth: state.reviewDepth,
    focusAreas: state.focusAreas,
    aiCredentials: state.aiCredentials,
  };

  if (fetched.changedFiles.length > 12) {
    logger.info('[pipeline] context budget applied', {
      reviewId: state.reviewId,
      filesChanged: fetched.changedFiles.length,
    });
  }

  const [specialist, holistic] = await Promise.all([
    orchestrator.runAllAgents(ctx, (done, total) => {
      const progress = 30 + Math.floor((done / total) * 45);
      void reviewService.updateStatus({
        reviewId: state.reviewId,
        status: 'analyzing',
        message: `Agents completed ${done}/${total}`,
        progress,
      });
    }),
    holisticReviewAgent.run(ctx).then((res) => {
      void reviewService.updateStatus({
        reviewId: state.reviewId,
        status: 'analyzing',
        message: 'Holistic code-review pass complete',
        progress: 80,
      });
      return res;
    }),
  ]);

  const findings = [...specialist.findings, ...holistic.findings];

  if (findings.length === 0 && holistic.changedFilesAnalysis.length === 0) {
    const providerError = aiHealth.consumeRecent();
    if (providerError) {
      throw new Error(`AI provider unavailable — ${providerError}`);
    }
  }

  return { ...specialist, findings, holistic };
}

export async function step3Comment(
  state: PipelineState,
  findings: Finding[],
  riskScore: number,
  mergeRecommendation: MergeRecommendation,
  holistic: HolisticReviewResult,
) {
  await reviewService.updateStatus({
    reviewId: state.reviewId,
    status: 'commenting',
    message: 'Saving review findings…',
    progress: 85,
  });

  await reviewService.saveComments(state.reviewId, findings);
  await reviewService.finalize({
    reviewId: state.reviewId,
    riskScore,
    mergeRecommendation,
    executiveSummary:
      holistic.overview || buildExecutiveSummary(findings, mergeRecommendation, riskScore),
    technicalSummary: `Pipeline analysed ${findings.length} findings across ${
      new Set(findings.map((f) => f.file)).size
    } files.`,
    deploymentRisk: deploymentRiskFromScore(riskScore),
  });

  await reviewService
    .saveHolisticSummary(state.reviewId, {
      health: holistic.health,
      topPriorityFixes: holistic.topPriorityFixes,
      changedFilesAnalysis: holistic.changedFilesAnalysis,
      overviewMarkdown: holistic.overview,
    })
    .catch((err: Error) =>
      logger.warn('[pipeline] saveHolisticSummary failed', { error: err.message }),
    );

  // NOTE: findings are intentionally NOT posted to the provider here. The AI
  // agent only generates and persists comments — the user reviews them in the
  // dashboard and explicitly pushes them to the PR via the "Post to provider"
  // button (POST /reviews/:id/post-to-github → postToProviderService).
}

async function deriveAiCheckConclusion(reviewId: string): Promise<string> {
  const row = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { mergeRecommendation: true },
  });
  const rec = row?.mergeRecommendation as MergeRecommendation | null | undefined;
  if (rec === 'BLOCK_MERGE' || rec === 'NEEDS_CHANGES') return 'failure';
  if (rec === 'APPROVE' || rec === 'APPROVE_WITH_MINOR_SUGGESTIONS') return 'success';
  return 'neutral';
}

export async function step5Complete(state: PipelineState) {
  const durationMs = Date.now() - state.startedAt;
  await reviewService.updateStatus({
    reviewId: state.reviewId,
    status: 'completed',
    message: 'Review complete',
    progress: 100,
    durationMs,
  });

  const prId = state.pullRequestId;
  if (prId) {
    await prDetailService
      .appendEvent({
        pullRequestId: prId,
        eventType: 'ai_review_completed',
        actor: 'reviewbot',
        payload: { reviewId: state.reviewId },
      })
      .catch(() => undefined);

    const conclusion = await deriveAiCheckConclusion(state.reviewId);
    await prDetailService
      .upsertCheck({
        pullRequestId: prId,
        name: 'AI Review',
        status: 'completed',
        conclusion,
      })
      .catch(() => undefined);
  }
}
