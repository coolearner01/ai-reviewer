'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GitPullRequestArrow, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reviewsApi, type PostToProviderResponse } from '@/lib/api/reviews';
import type { Provider } from '@/types';

interface PostToGitHubButtonProps {
  reviewId: string;
  provider: Provider;
  postedAt: string | null;
  commentCount: number;
}

const PROVIDER_LABEL: Record<Provider, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
};

const PROVIDER_SCOPE_HINT: Record<Provider, string> = {
  github:
    "Your GitHub PAT needs `pull_requests:write` (for inline comments) and `issues:write` (for the summary). A 403 'Resource not accessible by personal access token' means the token is missing one of these scopes.",
  gitlab:
    'Your GitLab token needs `api` scope (or `write_repository` at minimum) to post merge-request notes.',
  bitbucket:
    'Your Bitbucket app password needs `pullrequest:write` scope to post inline + summary comments.',
};

/**
 * Push this review's comments to the upstream provider. The AI pipeline only
 * generates and stores findings — it never posts to the PR automatically. This
 * button is the explicit "push comments to the PR" action: it posts every
 * inline finding plus the summary. Re-running it after a successful post acts
 * as a re-post (useful after fixing PAT scopes or when a PR is reopened).
 */
export function PostToGitHubButton({
  reviewId,
  provider,
  postedAt,
  commentCount,
}: PostToGitHubButtonProps) {
  const [lastResult, setLastResult] = useState<PostToProviderResponse | null>(null);

  const mutation = useMutation({
    mutationFn: () => reviewsApi.postToProvider(reviewId),
    onSuccess: (data) => {
      setLastResult(data);
      if (data.postedSummary && data.failedInline === 0) {
        toast.success(
          `Posted ${data.postedInline} inline comment${data.postedInline === 1 ? '' : 's'} + summary to ${PROVIDER_LABEL[provider]}.`,
        );
      } else if (data.postedInline > 0 || data.postedSummary) {
        toast.warning(
          `Partial post: ${data.postedInline}/${data.postedInline + data.failedInline} inline · summary ${data.postedSummary ? 'OK' : 'failed'}. See details below.`,
        );
      } else {
        toast.error(`Failed to post review to ${PROVIDER_LABEL[provider]}.`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || `Failed to post to ${PROVIDER_LABEL[provider]}`);
    },
  });

  const label = postedAt
    ? `Re-post to ${PROVIDER_LABEL[provider]}`
    : `Post to ${PROVIDER_LABEL[provider]}`;

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || commentCount === 0}
        title={
          commentCount === 0
            ? 'No findings to post yet'
            : `Push ${commentCount} inline comment${commentCount === 1 ? '' : 's'} + the AI summary directly to the PR thread`
        }
      >
        {mutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : lastResult && lastResult.failedInline === 0 && lastResult.postedSummary ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <GitPullRequestArrow className="h-3.5 w-3.5" />
        )}
        {label}
      </Button>

      {lastResult && lastResult.errors.length > 0 && (
        <div className="rounded-md border border-gh-yellow/40 bg-gh-yellow/10 px-3 py-2 text-xs text-[#e3b341] max-w-md">
          <div className="flex items-center gap-1.5 font-semibold mb-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {lastResult.errors.length} error{lastResult.errors.length === 1 ? '' : 's'} while posting
          </div>
          <ul className="space-y-0.5 list-disc pl-4 font-mono text-[11px]">
            {lastResult.errors.slice(0, 5).map((e, i) => (
              <li key={i} className="break-words">
                {e}
              </li>
            ))}
            {lastResult.errors.length > 5 && (
              <li>… and {lastResult.errors.length - 5} more</li>
            )}
          </ul>
          <p className="mt-2 text-[11px] text-gh-text-muted leading-relaxed">
            {PROVIDER_SCOPE_HINT[provider]}
          </p>
        </div>
      )}
    </div>
  );
}
