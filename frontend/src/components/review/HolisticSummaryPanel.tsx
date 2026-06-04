'use client';

import { useState } from 'react';
import {
  ListChecks,
  ChevronDown,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HEALTH_META } from '@/lib/reviewHealth';
import type { ReviewHealth } from '@/types';

interface HolisticSummaryPanelProps {
  health: ReviewHealth | null;
  overview: string | null;
  topPriorityFixes: string[];
  /**
   * Optional click handler for each priority fix. The PR detail page wires
   * this up to scroll to the closest matching finding by text overlap.
   */
  onFixClick?: (fix: string, index: number) => void;
}

/**
 * Top-of-page panel that surfaces the holistic reviewer's PR-level signal:
 * a health badge, the plain-English overview, and a checklist of the top
 * fixes the author should ship before merging.
 *
 * Fixes are clickable when `onFixClick` is provided — the PR detail page
 * uses that to scroll-and-flash the closest matching finding so users can
 * pivot from "what to do" → "where to do it" in a single click.
 */
export function HolisticSummaryPanel({
  health,
  overview,
  topPriorityFixes,
  onFixClick,
}: HolisticSummaryPanelProps) {
  const [overviewExpanded, setOverviewExpanded] = useState(true);
  const [fixesExpanded, setFixesExpanded] = useState(true);

  if (!health && !overview && topPriorityFixes.length === 0) return null;

  const meta = health ? HEALTH_META[health] : null;
  const interactive = Boolean(onFixClick);

  return (
    <div className="rounded-md border border-gh-border bg-gh-surface overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5">
        <button
          type="button"
          onClick={() => setOverviewExpanded((v) => !v)}
          className="group flex items-center gap-2 text-left -ml-1 px-1 py-0.5 rounded hover:bg-gh-surface-2 transition-colors"
          aria-expanded={overviewExpanded}
        >
          {overviewExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-gh-text-subtle group-hover:text-gh-text" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gh-text-subtle group-hover:text-gh-text" />
          )}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gh-text-subtle group-hover:text-gh-text">
            PR Review Summary
          </h3>
        </button>
        {meta && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.className}`}
          >
            <meta.Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
        )}
      </div>

      {overviewExpanded && overview && (
        <div className="px-5 pb-4 -mt-3">
          <p className="text-sm text-gh-text leading-relaxed whitespace-pre-line">
            {overview}
          </p>
        </div>
      )}

      {topPriorityFixes.length > 0 && (
        <div className="border-t border-gh-border">
          <button
            type="button"
            onClick={() => setFixesExpanded((v) => !v)}
            className="group w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-gh-surface-2 transition-colors"
            aria-expanded={fixesExpanded}
          >
            {fixesExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-gh-text-subtle group-hover:text-gh-text" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-gh-text-subtle group-hover:text-gh-text" />
            )}
            <ListChecks className="h-4 w-4 text-gh-text-subtle group-hover:text-gh-text" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gh-text-subtle group-hover:text-gh-text">
              Top priority fixes
            </h4>
            <span className="text-xs text-gh-text-muted">
              {topPriorityFixes.length} item{topPriorityFixes.length === 1 ? '' : 's'}
            </span>
            {interactive && (
              <span className="ml-auto text-[11px] text-gh-text-subtle hidden sm:inline">
                Click to jump
              </span>
            )}
          </button>

          {fixesExpanded && (
            <ol className="divide-y divide-gh-border-muted">
              {topPriorityFixes.map((fix, i) => (
                <li key={i}>
                  {interactive ? (
                    <button
                      type="button"
                      onClick={() => onFixClick?.(fix, i)}
                      className={cn(
                        'w-full text-left flex items-start gap-3 px-5 py-2.5 transition-colors',
                        'hover:bg-gh-blue/5 focus:outline-none focus-visible:bg-gh-blue/10',
                        'group/fix',
                      )}
                    >
                      <span className="font-mono text-xs text-gh-text-muted shrink-0 mt-0.5 w-6">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="flex-1 text-sm text-gh-text">{fix}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-1 text-gh-text-subtle opacity-0 -translate-x-1 group-hover/fix:opacity-100 group-hover/fix:translate-x-0 transition-all" />
                    </button>
                  ) : (
                    <div className="flex items-start gap-3 px-5 py-2.5">
                      <span className="font-mono text-xs text-gh-text-muted shrink-0 mt-0.5 w-6">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-sm text-gh-text">{fix}</span>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
