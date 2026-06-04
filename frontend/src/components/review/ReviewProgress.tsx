'use client';

import { cn } from '@/lib/utils';
import type { ReviewProgressEvent, ReviewStatus } from '@/types';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

const STEPS: { status: ReviewStatus; label: string }[] = [
  { status: 'fetching', label: 'Fetching PR diff and file contents' },
  { status: 'analyzing', label: 'Running AI review agents' },
  { status: 'commenting', label: 'Saving review findings' },
  { status: 'completed', label: 'Review complete' },
];

const STATUS_ORDER: ReviewStatus[] = STEPS.map((s) => s.status);

function stepIndex(status: ReviewStatus): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

export function ReviewProgress({
  prTitle,
  repoUrl,
  prUrl: _prUrl,
  latest,
}: {
  prTitle: string;
  repoUrl: string;
  prUrl: string;
  latest?: ReviewProgressEvent;
}) {
  const currentIdx = latest ? stepIndex(latest.status) : -1;
  const progress = latest?.progress ?? 0;

  return (
    <div className="max-w-xl mx-auto rounded-md border border-gh-border bg-gh-surface p-6">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider text-gh-text-subtle">Reviewing</p>
        <h2 className="text-lg font-semibold text-gh-text mt-1">{prTitle}</h2>
        <p className="text-sm text-gh-text-muted mt-1">
          {repoUrl.replace('https://', '')} → PR
        </p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm text-gh-text-muted mb-2">
          <span>{latest?.message ?? 'Starting…'}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gh-border-muted overflow-hidden">
          <div
            className="h-full bg-gh-blue-muted transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ul className="space-y-4">
        {STEPS.map((step, idx) => {
          const done = idx < currentIdx || latest?.status === 'completed';
          const active =
            idx === currentIdx &&
            latest?.status !== 'completed' &&
            latest?.status !== 'failed';
          const Icon = done ? CheckCircle2 : active ? Loader2 : Circle;
          return (
            <li key={step.status} className="flex items-center gap-3">
              <Icon
                className={cn(
                  'h-5 w-5 shrink-0',
                  done && 'text-[#3fb950]',
                  active && 'text-gh-blue-muted animate-spin',
                  !done && !active && 'text-gh-text-subtle',
                )}
              />
              <span
                className={cn(
                  'text-sm',
                  done && 'text-gh-text',
                  active && 'text-gh-text font-medium',
                  !done && !active && 'text-gh-text-subtle',
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>

      {latest?.status === 'failed' && (
        <div className="mt-6 rounded-md border border-gh-red/50 bg-gh-red/10 p-4 text-sm text-[#f85149]">
          {latest.message}
        </div>
      )}
    </div>
  );
}
