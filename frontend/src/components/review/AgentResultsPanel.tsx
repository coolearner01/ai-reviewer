'use client';

import { Trash2, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { agentLabels, cn, riskScoreClass, severityColors } from '@/lib/utils';
import type { AgentSummary, ReviewCommentRecord, Severity } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { SeverityBadge } from '@/components/review/MergeRecommendationBanner';
import { reviewsApi } from '@/lib/api/reviews';

/**
 * Refetch everything that surfaces this comment after a discard/restore.
 *
 * The single review query (`['review', id]`) is invalidated by id, and any
 * URL-based lookup query (`['review-lookup', org, repo, prId]`) is matched by
 * its prefix. We deliberately keep this broad because the same comment list
 * also drives severity counts, agent summaries, and the post-to-provider flow.
 */
function useDiscardComment(comment: ReviewCommentRecord) {
  const qc = useQueryClient();

  const refetchEverything = () => {
    void qc.invalidateQueries({ queryKey: ['review', comment.reviewId] });
    void qc.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey[0];
        return key === 'review-lookup' || key === 'reviews';
      },
    });
  };

  const restore = useMutation({
    mutationFn: () => reviewsApi.restoreComment(comment.reviewId, comment.id),
    onSuccess: () => {
      toast.success('Comment restored');
      refetchEverything();
    },
    onError: (err: Error) => toast.error(`Restore failed: ${err.message}`),
  });

  const discard = useMutation({
    mutationFn: () => reviewsApi.discardComment(comment.reviewId, comment.id),
    onSuccess: () => {
      toast.success('Comment discarded', {
        action: {
          label: 'Undo',
          onClick: () => restore.mutate(),
        },
      });
      refetchEverything();
    },
    onError: (err: Error) => toast.error(`Discard failed: ${err.message}`),
  });

  return { discard, restore };
}

function AgentFindingCard({ comment }: { comment: ReviewCommentRecord }) {
  const { discard } = useDiscardComment(comment);

  const handleDiscard = () => {
    const ok = window.confirm(
      `Discard this ${comment.severity} finding?\n\n${comment.title}\n\nIt will be removed from the review summary and skipped when posting to the provider. You can undo this from the toast.`,
    );
    if (ok) discard.mutate();
  };

  return (
    <div
      id={`finding-${comment.id}`}
      className={cn(
        'rounded-md border p-4 mb-3 transition-shadow',
        severityColors[comment.severity].bg,
        severityColors[comment.severity].border,
        discard.isPending && 'opacity-60 pointer-events-none',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-semibold text-sm text-gh-text">{comment.title}</h4>
          {comment.category && (
            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium bg-gh-canvas border border-gh-border text-gh-text-muted">
              {comment.category}
            </span>
          )}
        </div>
        <div className="flex items-start gap-1.5 shrink-0">
          <SeverityBadge severity={comment.severity} />
          <button
            type="button"
            onClick={handleDiscard}
            disabled={discard.isPending}
            title="Discard this finding"
            aria-label="Discard this finding"
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-[11px] text-gh-text-muted',
              'hover:border-gh-red/40 hover:bg-gh-red/10 hover:text-gh-red transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Discard</span>
          </button>
        </div>
      </div>
      <p className="text-xs text-gh-text-muted mt-1 font-mono">
        {comment.file}:{comment.line}
      </p>
      <p className="text-sm text-gh-text mt-3">{comment.issue}</p>
      <p className="text-sm text-gh-text-muted mt-2">
        <strong className="text-gh-text">Impact:</strong> {comment.impact}
      </p>
      <p className="text-sm text-gh-text-muted mt-2">
        <strong className="text-gh-text">Recommendation:</strong> {comment.recommendation}
      </p>
      {comment.suggestedFix && (
        <pre className="mt-3 rounded-md bg-gh-sidebar border border-gh-border-muted text-gh-text-muted p-3 text-xs overflow-x-auto font-mono">
          {comment.suggestedFix}
        </pre>
      )}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gh-border-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gh-blue-muted"
            style={{ width: `${comment.confidence * 100}%` }}
          />
        </div>
        <span className="text-xs text-gh-text-muted">
          {Math.round(comment.confidence * 100)}%
        </span>
      </div>
    </div>
  );
}

export function AgentResultsPanel({
  agentSummaries,
  comments,
  fileFilter,
  onClearFileFilter,
  severityFilter,
  onClearSeverityFilter,
}: {
  agentSummaries: AgentSummary[];
  comments: ReviewCommentRecord[];
  /** When set, only findings matching this file path are shown. */
  fileFilter?: string | null;
  /** Callback to clear the active file filter (renders a banner+button). */
  onClearFileFilter?: () => void;
  /** When set, only findings with this severity are shown. */
  severityFilter?: Severity | null;
  /** Callback to clear the severity filter from inside the banner. */
  onClearSeverityFilter?: () => void;
}) {
  const activeFilter = fileFilter ?? null;
  const activeSeverity = severityFilter ?? null;

  const visibleComments = comments.filter((c) => {
    if (activeFilter && c.file !== activeFilter) return false;
    if (activeSeverity && c.severity !== activeSeverity) return false;
    return true;
  });

  const byAgent = new Map<string, ReviewCommentRecord[]>();
  for (const c of visibleComments) {
    const list = byAgent.get(c.agentType) ?? [];
    list.push(c);
    byAgent.set(c.agentType, list);
  }

  // Rebuild agent summaries against the visible subset. When unfiltered we still
  // honor the server-provided summaries so severity counts stay accurate.
  const filtered = Boolean(activeFilter || activeSeverity);
  const agents = filtered
    ? Array.from(byAgent.keys()).map((agentType) => ({
        agentType: agentType as AgentSummary['agentType'],
        findingCount: byAgent.get(agentType)!.length,
        severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
      }))
    : agentSummaries.length
      ? agentSummaries
      : Array.from(byAgent.keys()).map((agentType) => ({
          agentType: agentType as AgentSummary['agentType'],
          findingCount: byAgent.get(agentType)!.length,
          severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
        }));

  const filterBanner = filtered ? (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-gh-blue/40 bg-gh-blue/10 px-3 py-2 text-xs text-gh-text">
      <span className="text-gh-text-muted uppercase tracking-wider">Filtered</span>
      {activeFilter && (
        <span className="inline-flex items-center gap-1.5">
          <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-gh-canvas border border-gh-border text-gh-blue-muted truncate max-w-[28ch]">
            {activeFilter}
          </code>
          {onClearFileFilter && (
            <button
              type="button"
              onClick={onClearFileFilter}
              aria-label="Clear file filter"
              className="rounded-full p-0.5 text-gh-text-muted hover:bg-gh-surface hover:text-gh-text"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      )}
      {activeSeverity && (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] capitalize',
            severityColors[activeSeverity].badge,
          )}
        >
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 rounded-full',
              severityColors[activeSeverity].dot,
            )}
          />
          {activeSeverity}
          {onClearSeverityFilter && (
            <button
              type="button"
              onClick={onClearSeverityFilter}
              aria-label="Clear severity filter"
              className="-mr-0.5 rounded-full p-0.5 hover:bg-black/20"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      )}
      <span className="text-gh-text-muted">
        · {visibleComments.length} of {comments.length} findings
      </span>
    </div>
  ) : null;

  if (agents.length === 0) {
    return (
      <div>
        {filterBanner}
        <div className="rounded-md border border-gh-accent/50 bg-gh-accent/10 p-6 text-center text-[#3fb950]">
          {filtered
            ? '✓ No findings match the current filters'
            : '✓ No issues found by any agent'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {filterBanner}
      <div className="rounded-md border border-gh-border bg-gh-surface px-4">
        <Accordion type="multiple" defaultValue={agents.map((a) => a.agentType)}>
          {agents.map((summary) => {
            const agentComments = byAgent.get(summary.agentType) ?? [];
            const label = agentLabels[summary.agentType] ?? summary.agentType;
            return (
              <AccordionItem key={summary.agentType} value={summary.agentType}>
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    {label}
                    <span className="text-xs text-gh-text-muted">
                      ({summary.findingCount} findings)
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {agentComments.length === 0 ? (
                    <p className="text-sm text-[#3fb950]">✓ No issues found</p>
                  ) : (
                    agentComments.map((c) => <AgentFindingCard key={c.id} comment={c} />)
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}

export function FileRiskTable({
  files,
  selectedFile,
  onSelectFile,
}: {
  files: Array<{
    file: string;
    riskScore: number;
    findingCount: number;
    severityBreakdown: Record<string, number>;
  }>;
  selectedFile?: string | null;
  onSelectFile?: (file: string) => void;
}) {
  if (files.length === 0) return null;
  const interactive = Boolean(onSelectFile);
  return (
    <div className="rounded-md border border-gh-border bg-gh-surface overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gh-surface-2 border-b border-gh-border">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
              File
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
              Risk
            </th>
            <th className="text-left px-4 py-2.5 font-medium text-gh-text-muted text-xs uppercase tracking-wider">
              Findings
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => {
            const isSelected = selectedFile === f.file;
            return (
              <tr
                key={f.file}
                onClick={interactive ? () => onSelectFile?.(f.file) : undefined}
                className={cn(
                  'border-b border-gh-border-muted last:border-0 transition-colors',
                  interactive && 'cursor-pointer hover:bg-gh-surface-2',
                  isSelected && 'bg-gh-blue/10',
                )}
                aria-selected={isSelected || undefined}
              >
                <td
                  className={cn(
                    'px-4 py-3 font-mono text-xs',
                    isSelected ? 'text-gh-blue-muted' : 'text-gh-text',
                  )}
                >
                  {f.file}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-semibold border',
                      riskScoreClass(f.riskScore),
                    )}
                  >
                    {f.riskScore}
                  </span>
                </td>
                <td className="px-4 py-3 text-gh-text-muted">{f.findingCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
