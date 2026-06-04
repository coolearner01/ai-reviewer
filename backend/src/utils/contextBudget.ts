/**
 * Token-budget helpers for AI review prompts.
 *
 * OpenRouter (and some Anthropic tiers) reject requests when the prompt exceeds
 * the model's context window. Large PRs with 15+ files can easily blow past
 * 20k–30k tokens — we cap diff + file contents before agents run.
 */

export interface ContextBudget {
  /** Max chars for the unified diff block. */
  maxDiffChars: number;
  /** Max chars per file when embedding full file contents. */
  maxFileChars: number;
  /** How many files get full-content embedding (rest are diff-only). */
  maxFilesWithContent: number;
}

/** Pick tighter limits as the PR grows. */
export function budgetForFileCount(fileCount: number): ContextBudget {
  if (fileCount > 20) {
    return { maxDiffChars: 20_000, maxFileChars: 6_000, maxFilesWithContent: 6 };
  }
  if (fileCount > 12) {
    return { maxDiffChars: 35_000, maxFileChars: 10_000, maxFilesWithContent: 10 };
  }
  if (fileCount > 6) {
    return { maxDiffChars: 50_000, maxFileChars: 15_000, maxFilesWithContent: 12 };
  }
  return { maxDiffChars: 80_000, maxFileChars: 30_000, maxFilesWithContent: 20 };
}

export function truncateText(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + `\n\n... [truncated ${text.length - max} chars]`;
}

/**
 * Shrink fileContents + diff to fit the budget. Always keeps the full changed
 * file list — agents still know what changed, but only the first N files get
 * embedded source.
 */
export function applyContextBudget(input: {
  diff: string;
  changedFiles: string[];
  fileContents: Record<string, string>;
}): { diff: string; changedFiles: string[]; fileContents: Record<string, string> } {
  const budget = budgetForFileCount(input.changedFiles.length);
  const keep = new Set(input.changedFiles.slice(0, budget.maxFilesWithContent));
  const fileContents: Record<string, string> = {};

  for (const path of keep) {
    const raw = input.fileContents[path];
    if (raw) fileContents[path] = truncateText(raw, budget.maxFileChars);
  }

  return {
    diff: truncateText(input.diff, budget.maxDiffChars),
    changedFiles: input.changedFiles,
    fileContents,
  };
}
