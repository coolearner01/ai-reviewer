import { AGENT_PROMPTS } from './prompts';
import type { ReviewContext } from '../types';

/** The expert-reviewer system prompt — exported separately so the agent file stays small. */
export const HOLISTIC_REVIEW_PROMPT = AGENT_PROMPTS.holistic_review;

/** Build the user message sent alongside the holistic prompt. */
export function buildHolisticUserMessage(ctx: ReviewContext): string {
  const files = ctx.changedFiles.join('\n');
  const fileContents = Object.entries(ctx.fileContents)
    .map(([path, content]) => `=== FILE: ${path} ===\n${truncate(content)}`)
    .join('\n\n');

  return `Review the following Pull Request and return ONLY the JSON object specified in the system prompt.

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
${truncate(ctx.diff, 80_000)}
\`\`\`

## Full File Contents (for context)
${fileContents || '(none)'}

Return the JSON object now.`;
}

function truncate(text: string, max = 30_000): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n... [truncated ${text.length - max} chars]`;
}
