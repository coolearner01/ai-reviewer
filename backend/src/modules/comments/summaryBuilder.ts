import { AGENT_LABELS } from '../../agents/prompts';
import type {
  Finding,
  MergeRecommendation,
  Provider,
  Severity,
} from '../../types';

const MERGE_LABEL: Record<MergeRecommendation, string> = {
  APPROVE: '✅ Approve',
  APPROVE_WITH_MINOR_SUGGESTIONS: '🟢 Approve with suggestions',
  NEEDS_CHANGES: '🟠 Needs changes',
  BLOCK_MERGE: '🔴 Block merge',
};

const SEVERITY_EMOJI: Record<Severity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
};

/**
 * Build the summary comment body for a reviewed PR.
 * GitHub/GitLab use Markdown; Bitbucket uses a similar subset in `content.raw`.
 */
export function buildSummaryMarkdown(input: {
  provider?: Provider;
  riskScore: number;
  mergeRecommendation: MergeRecommendation;
  findings: Finding[];
  /** Holistic overview block (optional — when present, prepended to the summary). */
  overview?: string;
  /** Holistic top-priority fixes (optional — rendered as a checklist). */
  topPriorityFixes?: string[];
  /** Holistic verdict reason (optional — appended to the recommendation line). */
  verdictReason?: string;
}): string {
  const provider = input.provider ?? 'github';
  const { riskScore, mergeRecommendation, findings } = input;
  const counts = {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
  };

  const byAgent = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byAgent.get(f.agentType) ?? [];
    list.push(f);
    byAgent.set(f.agentType, list);
  }

  const agentTable = [...byAgent.entries()]
    .map(([agent, list]) => {
      const label = AGENT_LABELS[agent as keyof typeof AGENT_LABELS] ?? agent;
      const top = list.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
      return `| ${label} | ${list.length} | ${SEVERITY_EMOJI[top.severity]} ${top.severity} |`;
    })
    .join('\n');

  const footer =
    provider === 'gitlab'
      ? '---\n_Inline notes are posted on this merge request. Full report is available in PR Review AI._'
      : provider === 'bitbucket'
        ? '----\n*Inline comments are attached to the diff. Open PR Review AI for the full report.*'
        : '_Inline review comments are attached to the diff. Open PR Review AI for the full report._';

  const title =
    provider === 'gitlab'
      ? '## 🤖 AI Merge Request Review'
      : provider === 'bitbucket'
        ? '## 🤖 AI Pull Request Review'
        : '## 🤖 AI Pull Request Review';

  const overviewBlock = input.overview?.trim()
    ? [`### Overview`, input.overview.trim(), ``]
    : [];

  const recommendationLine = input.verdictReason?.trim()
    ? `**Recommendation:** ${MERGE_LABEL[mergeRecommendation]} — ${input.verdictReason.trim()}`
    : `**Recommendation:** ${MERGE_LABEL[mergeRecommendation]}`;

  const topFixesBlock = input.topPriorityFixes && input.topPriorityFixes.length > 0
    ? [
        ``,
        `### Top priority fixes`,
        ...input.topPriorityFixes.map((f) => `- [ ] ${f}`),
      ]
    : [];

  return [
    title,
    ``,
    ...overviewBlock,
    recommendationLine,
    `**Risk score:** \`${riskScore}/100\``,
    ``,
    `### Findings`,
    `🔴 Critical: **${counts.critical}**`,
    `🟠 High: **${counts.high}**`,
    `🟡 Medium: **${counts.medium}**`,
    `🔵 Low: **${counts.low}**`,
    ``,
    `### Per agent`,
    `| Agent | Findings | Top severity |`,
    `| --- | --- | --- |`,
    agentTable || `| (no agents returned findings) | | |`,
    ...topFixesBlock,
    ``,
    footer,
  ].join('\n');
}

/** Body for a single inline / line comment — formatted per provider. */
export function buildInlineCommentBody(f: Finding, provider: Provider = 'github'): string {
  const agent = AGENT_LABELS[f.agentType] ?? f.agentType;
  const confidence = `${Math.round(f.confidence * 100)}% confidence`;
  const categoryTag = f.category ? ` · 🏷️ ${f.category}` : '';

  if (provider === 'bitbucket') {
    return [
      `*${SEVERITY_EMOJI[f.severity]} ${f.title}* (${agent}${categoryTag}, ${confidence})`,
      ``,
      f.issue,
      ``,
      `*Impact:* ${f.impact}`,
      ``,
      `*Recommendation:* ${f.recommendation}`,
      f.suggestedFix ? `\n\n{code}\n${f.suggestedFix}\n{code}` : '',
    ].join('\n');
  }

  if (provider === 'gitlab') {
    return [
      `${SEVERITY_EMOJI[f.severity]} **${f.title}** *(${agent}${categoryTag}, ${confidence})*`,
      ``,
      f.issue,
      ``,
      `**Impact:** ${f.impact}`,
      ``,
      `**Recommendation:** ${f.recommendation}`,
      f.suggestedFix ? `\n\n\`\`\`suggestion\n${f.suggestedFix}\n\`\`\`` : '',
    ].join('\n');
  }

  // GitHub — standard GFM with fenced code for suggested fixes
  return [
    `${SEVERITY_EMOJI[f.severity]} **${f.title}** _(${agent}${categoryTag}, ${confidence})_`,
    ``,
    f.issue,
    ``,
    `**Impact:** ${f.impact}`,
    ``,
    `**Recommendation:** ${f.recommendation}`,
    f.suggestedFix ? `\n\n\`\`\`suggestion\n${f.suggestedFix}\n\`\`\`` : '',
  ].join('\n');
}

function severityRank(s: Severity): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[s];
}
