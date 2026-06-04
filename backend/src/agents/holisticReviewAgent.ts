import { aiClient } from '../infrastructure/ai/aiClient';
import { logger } from '../utils/logger';
import { HOLISTIC_REVIEW_PROMPT, buildHolisticUserMessage } from './holisticPrompt';
import type {
  AgentType,
  ChangedFileAnalysis,
  Finding,
  OverallVerdict,
  ReviewCategory,
  ReviewContext,
  ReviewHealth,
  ReviewSide,
  Severity,
} from '../types';

const MAX_TOKENS = 8192;

/**
 * Severity returned by the holistic prompt is `error | warning | info`.
 * The rest of the system uses `critical | high | medium | low`. Map them.
 */
function mapSeverity(s: unknown): Severity {
  if (s === 'error') return 'high';
  if (s === 'warning') return 'medium';
  if (s === 'info') return 'low';
  if (s === 'critical' || s === 'high' || s === 'medium' || s === 'low') return s;
  return 'low';
}

const ALLOWED_CATEGORIES: ReviewCategory[] = [
  'DRY',
  'Modularity',
  'Utils',
  'Core Change',
  'Design',
  'Naming',
  'Folder Structure',
  'Styling',
  'Constants',
  'Typing',
  'Regex',
  'Security',
  'Performance',
  'Other',
];

function mapCategory(c: unknown): ReviewCategory | null {
  if (typeof c !== 'string') return null;
  return (ALLOWED_CATEGORIES as string[]).includes(c) ? (c as ReviewCategory) : 'Other';
}

function mapSide(s: unknown): ReviewSide {
  return s === 'LEFT' ? 'LEFT' : 'RIGHT';
}

function mapHealth(h: unknown): ReviewHealth | null {
  return h === 'good' || h === 'needs_work' || h === 'critical' ? h : null;
}

function mapVerdict(v: unknown): OverallVerdict {
  return v === 'APPROVE' || v === 'REQUEST_CHANGES' || v === 'COMMENT' ? v : 'COMMENT';
}

function mapRiskLevel(r: unknown): 'low' | 'medium' | 'high' {
  return r === 'low' || r === 'medium' || r === 'high' ? r : 'medium';
}

export interface HolisticReviewResult {
  findings: Finding[];
  health: ReviewHealth | null;
  overview: string;
  topPriorityFixes: string[];
  changedFilesAnalysis: ChangedFileAnalysis[];
  overallVerdict: OverallVerdict;
  verdictReason: string;
}

const EMPTY_RESULT: HolisticReviewResult = {
  findings: [],
  health: null,
  overview: '',
  topPriorityFixes: [],
  changedFilesAnalysis: [],
  overallVerdict: 'COMMENT',
  verdictReason: '',
};

/**
 * Holistic reviewer — single LLM call that produces:
 *   - structured per-line findings (mapped to the existing Finding shape)
 *   - a PR-level summary block (overview, health, top_priority_fixes,
 *     changed_files_analysis, overall_verdict)
 *
 * Differs from the BaseAgent pattern because the LLM returns an OBJECT, not
 * an array, and we want to keep the summary fields too.
 */
export const holisticReviewAgent = {
  agentType: 'holistic_review' as AgentType,

  async run(ctx: ReviewContext): Promise<HolisticReviewResult> {
    try {
      const { text, provider, model } = await aiClient.complete({
        systemPrompt: HOLISTIC_REVIEW_PROMPT,
        userMessage: buildHolisticUserMessage(ctx),
        maxTokens: MAX_TOKENS,
        credentials: ctx.aiCredentials,
      });

      logger.debug('[holistic] completion received', {
        provider,
        model,
        textLength: text.length,
      });

      const obj = extractJsonObject(text);
      if (!obj) {
        logger.warn('[holistic] no JSON object in response', {
          preview: text.slice(0, 200),
        });
        return EMPTY_RESULT;
      }

      return normalizeResult(obj);
    } catch (err) {
      logger.error('[holistic] run failed', { error: (err as Error).message });
      return EMPTY_RESULT;
    }
  },
};

function normalizeResult(raw: Record<string, unknown>): HolisticReviewResult {
  const summary = (raw.summary ?? {}) as Record<string, unknown>;
  const overview = typeof summary.overview === 'string' ? summary.overview : '';
  const health = mapHealth(summary.health);

  const topPriorityFixes = Array.isArray(summary.top_priority_fixes)
    ? summary.top_priority_fixes.filter((s): s is string => typeof s === 'string').slice(0, 10)
    : [];

  const changedFilesAnalysis: ChangedFileAnalysis[] = Array.isArray(summary.changed_files_analysis)
    ? summary.changed_files_analysis
        .map((entry): ChangedFileAnalysis | null => {
          if (!entry || typeof entry !== 'object') return null;
          const e = entry as Record<string, unknown>;
          if (typeof e.file !== 'string' || !e.file) return null;
          return {
            file: e.file,
            whatChanged: typeof e.what_changed === 'string' ? e.what_changed : '',
            whyItMatters: typeof e.why_it_matters === 'string' ? e.why_it_matters : '',
            riskLevel: mapRiskLevel(e.risk_level),
            dependenciesAffected: Array.isArray(e.dependencies_affected)
              ? e.dependencies_affected.filter((s): s is string => typeof s === 'string')
              : [],
          };
        })
        .filter((e): e is ChangedFileAnalysis => e !== null)
    : [];

  const findings: Finding[] = Array.isArray(raw.review_comments)
    ? raw.review_comments
        .map((entry): Finding | null => {
          if (!entry || typeof entry !== 'object') return null;
          const c = entry as Record<string, unknown>;
          const file = typeof c.path === 'string' ? c.path : typeof c.file === 'string' ? c.file : '';
          const lineRaw = c.line;
          const line = typeof lineRaw === 'number'
            ? lineRaw
            : typeof lineRaw === 'string'
              ? Number(lineRaw)
              : NaN;
          if (!file || !Number.isFinite(line)) return null;

          const title = typeof c.title === 'string' && c.title
            ? c.title
            : typeof c.body === 'string'
              ? c.body.slice(0, 80)
              : 'Code review note';
          const issue = typeof c.issue === 'string'
            ? c.issue
            : typeof c.body === 'string'
              ? c.body
              : '';
          const impact = typeof c.impact === 'string' ? c.impact : '';
          const recommendation = typeof c.recommendation === 'string' ? c.recommendation : '';
          const suggestedFix = typeof c.suggested_fix === 'string'
            ? c.suggested_fix
            : typeof c.suggestedFix === 'string'
              ? c.suggestedFix
              : undefined;

          return {
            agentType: 'holistic_review',
            category: mapCategory(c.category),
            file,
            line,
            side: mapSide(c.side),
            title,
            issue,
            impact,
            recommendation,
            suggestedFix: suggestedFix || undefined,
            severity: mapSeverity(c.severity),
            confidence: 0.85,
          };
        })
        .filter((f): f is Finding => f !== null)
    : [];

  return {
    findings,
    health,
    overview,
    topPriorityFixes,
    changedFilesAnalysis,
    overallVerdict: mapVerdict(raw.overall_verdict),
    verdictReason: typeof raw.verdict_reason === 'string' ? raw.verdict_reason : '',
  };
}

/**
 * Pulls the first JSON object out of an LLM response. Tolerant of leading
 * prose, ```json fences, etc. Returns null if the slice is unparsable.
 */
function extractJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/g, '')
    .trim();

  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;

  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
