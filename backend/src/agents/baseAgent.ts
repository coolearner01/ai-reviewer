import { aiClient } from '../infrastructure/ai/aiClient';
import { logger } from '../utils/logger';
import type { AgentType, Finding, ReviewContext, Severity } from '../types';

const MAX_TOKENS = 4096;

/**
 * Shared logic for every AI agent.
 *
 * Subclasses only need to provide:
 *   - readonly agentType
 *   - readonly systemPrompt
 *
 * Everything else (LLM call + provider fallback, JSON extraction, validation,
 * defaults) lives here so we have ONE place to fix when the LLM occasionally
 * returns slightly malformed JSON.
 *
 * The underlying `aiClient` tries Anthropic first and falls back to OpenRouter
 * on failure — agents don't care which provider answered.
 */
export abstract class BaseAgent {
  abstract readonly agentType: AgentType;
  abstract readonly systemPrompt: string;

  /** Override to opt out of running for certain contexts (e.g. frontend agent). */
  shouldRun(_ctx: ReviewContext): boolean {
    return true;
  }

  async analyze(ctx: ReviewContext): Promise<Finding[]> {
    if (!this.shouldRun(ctx)) return [];

    const userMessage = buildUserMessage(ctx);

    try {
      const { text, provider, model } = await aiClient.complete({
        systemPrompt: this.systemPrompt,
        userMessage,
        maxTokens: MAX_TOKENS,
        credentials: ctx.aiCredentials,
      });

      logger.debug('[agent] completion received', {
        agent: this.agentType,
        provider,
        model,
        textLength: text.length,
      });

      const raw = extractJsonArray(text);
      if (!raw) {
        logger.warn('[agent] no JSON array in response', {
          agent: this.agentType,
          provider,
          preview: text.slice(0, 200),
        });
        return [];
      }

      return raw
        .map((entry) => this.normalize(entry))
        .filter((f): f is Finding => f !== null);
    } catch (err) {
      logger.error('[agent] analyze failed', {
        agent: this.agentType,
        error: (err as Error).message,
      });
      // Never throw out of an agent — the orchestrator uses allSettled, but
      // a graceful empty result keeps the pipeline moving without noise.
      return [];
    }
  }

  /** Cast a raw object from the LLM into a typed Finding, dropping invalid entries. */
  private normalize(raw: unknown): Finding | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;

    const severity = asSeverity(r.severity);
    const confidence = asNumber(r.confidence);
    const line = asNumber(r.line);
    const endLine = r.endLine !== undefined ? asNumber(r.endLine) : undefined;

    const file = asString(r.file);
    const title = asString(r.title);
    const issue = asString(r.issue);
    const impact = asString(r.impact);
    const recommendation = asString(r.recommendation);
    const suggestedFix = r.suggestedFix !== undefined ? asString(r.suggestedFix) : undefined;

    if (!severity || !file || !title || !issue || confidence === null || line === null) {
      return null;
    }

    return {
      agentType: this.agentType,
      file,
      line,
      endLine: endLine ?? undefined,
      title,
      issue,
      impact: impact || '',
      recommendation: recommendation || '',
      suggestedFix: suggestedFix || undefined,
      severity,
      confidence: clamp01(confidence),
    };
  }
}

function buildUserMessage(ctx: ReviewContext): string {
  const files = ctx.changedFiles.join('\n');
  const fileContents = Object.entries(ctx.fileContents)
    .map(([path, content]) => `=== FILE: ${path} ===\n${truncateForContext(content)}`)
    .join('\n\n');

  return `You are reviewing the following Pull Request.

## Repository
${ctx.prMeta.repoUrl}

## PR Title
${ctx.prMeta.title}

## Author
${ctx.prMeta.author}

## Source → Target Branch
${ctx.prMeta.sourceBranch} → ${ctx.prMeta.targetBranch}

## Custom Instructions (if any)
${ctx.customPrompt || '(none)'}

## Changed Files
${files || '(none)'}

## Full Diff
\`\`\`diff
${truncateForContext(ctx.diff, 80_000)}
\`\`\`

## Full File Contents (for context)
${fileContents || '(none)'}

Return ONLY a valid JSON array. No prose, no markdown, no explanation.
If you find no issues, return an empty array: []

JSON schema for each finding:
{
  "agentType": "security",
  "file": "src/auth/login.ts",
  "line": 42,
  "endLine": 45,
  "title": "Short imperative title",
  "issue": "What is wrong",
  "impact": "Why it matters",
  "recommendation": "How to fix it",
  "suggestedFix": "Code snippet (optional)",
  "severity": "critical",
  "confidence": 0.95
}`;
}

/** Cap individual file/diff size so a giant PR doesn't blow the token budget. */
function truncateForContext(text: string, max = 30_000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n... [truncated ${text.length - max} chars]`;
}

/**
 * Pulls the first JSON array out of a Claude response. Tolerant of:
 *   - leading/trailing prose
 *   - ```json fences
 *   - the whole thing being JSON already
 *
 * Returns null on total failure (caller logs).
 */
function extractJsonArray(raw: string): unknown[] | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/g, '')
    .trim();

  const start = stripped.indexOf('[');
  const end = stripped.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return null;

  const slice = stripped.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function asSeverity(v: unknown): Severity | null {
  return v === 'critical' || v === 'high' || v === 'medium' || v === 'low' ? v : null;
}
function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
