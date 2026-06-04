'use client';

import { useEffect, useMemo, useState } from 'react';
import { useReviewProgress } from '@/lib/hooks/useReviewProgress';
import { progressFromReview } from '@/lib/reviewProgress';
import type { ReviewCommentRecord, ReviewResult, Severity } from '@/types';

export function useReviewView(data: ReviewResult, refetch: () => void) {
  const { review, comments } = data;
  const inProgress = review.status !== 'completed' && review.status !== 'failed';
  const { latest, isComplete, error: progressError } = useReviewProgress(review.id, inProgress);

  useEffect(() => {
    if (isComplete) void refetch();
  }, [isComplete, refetch]);

  const polledProgress = progressFromReview(review);
  const displayLatest =
    latest && latest.progress >= polledProgress.progress ? latest : polledProgress;

  const severityCounts = useMemo(() => {
    const acc: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const c of comments) acc[c.severity] = (acc[c.severity] ?? 0) + 1;
    return acc;
  }, [comments]);

  const [severityFilter, setSeverityFilter] = useState<Set<Severity>>(new Set());
  const [findingSearch, setFindingSearch] = useState('');

  const filteredComments = useMemo(() => {
    const q = findingSearch.trim().toLowerCase();
    return comments.filter((c) => {
      if (severityFilter.size > 0 && !severityFilter.has(c.severity)) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.issue.toLowerCase().includes(q) ||
        c.recommendation.toLowerCase().includes(q) ||
        c.file.toLowerCase().includes(q) ||
        (c.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [comments, severityFilter, findingSearch]);

  return {
    inProgress,
    progressError,
    displayLatest,
    severityCounts,
    severityFilter,
    setSeverityFilter,
    findingSearch,
    setFindingSearch,
    filteredComments,
    toggleSeverity: (s: Severity) => {
      setSeverityFilter((prev) => {
        const next = new Set(prev);
        if (next.has(s)) next.delete(s);
        else next.add(s);
        return next;
      });
    },
  };
}

export function countSeverity(comments: ReviewCommentRecord[]): Record<Severity, number> {
  const acc: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const c of comments) acc[c.severity] = (acc[c.severity] ?? 0) + 1;
  return acc;
}
