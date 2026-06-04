'use client';

import { ChevronRight } from 'lucide-react';
import { cn, mergeColors, riskScoreClass, severityColors } from '@/lib/utils';
import type { MergeRecommendation, Severity } from '@/types';

export function MergeRecommendationBanner({
  recommendation,
  riskScore,
  commentCount,
  deploymentRisk,
}: {
  recommendation: MergeRecommendation;
  riskScore: number;
  commentCount: number;
  /** Optional one-line deployment-risk summary, rendered inline after findings. */
  deploymentRisk?: string | null;
}) {
  const colors = mergeColors[recommendation];

  // Banner becomes a button when there are findings to jump to.
  const interactive = commentCount > 0;
  const onClick = () => {
    if (!interactive) return;
    const el = document.getElementById('findings-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const inner = (
    <>
      <span className="text-sm font-semibold whitespace-nowrap">{colors.label}</span>
      <span className="text-xs opacity-80 whitespace-nowrap">
        {commentCount === 0
          ? '✓ No issues found by any agent'
          : `${commentCount} finding${commentCount === 1 ? '' : 's'}`}
      </span>
      {deploymentRisk && (
        <>
          <span className="text-xs opacity-40">·</span>
          <span className="text-xs opacity-80 min-w-0 truncate">
            <span className="font-medium opacity-90">Deployment risk:</span>{' '}
            {deploymentRisk}
          </span>
        </>
      )}
      <span
        className={cn(
          'ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap',
          riskScoreClass(riskScore),
        )}
      >
        Risk: {riskScore}/100
      </span>
      {interactive && (
        <ChevronRight className="h-4 w-4 opacity-60 shrink-0 transition-transform group-hover:translate-x-0.5" />
      )}
    </>
  );

  const classes = cn(
    'rounded-md border px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-left',
    colors.bg,
    colors.border,
    colors.text,
    interactive && 'group cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current',
  );

  return interactive ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(classes, 'w-full')}
      aria-label="Jump to findings"
    >
      {inner}
    </button>
  ) : (
    <div className={classes}>{inner}</div>
  );
}

export function RiskScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border',
        riskScoreClass(score),
      )}
    >
      {score}/100
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const c = severityColors[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium',
        c.badge,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {severity}
    </span>
  );
}
