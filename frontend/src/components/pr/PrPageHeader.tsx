import { GitPullRequest, GitMerge, X, ExternalLink, ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PullRequestRecord, RepositoryRecord, PullRequestState } from '@/types';

interface PrPageHeaderProps {
  prId: string;
  pullRequest: PullRequestRecord | null;
  repository: RepositoryRecord | null;
  /** Optional action slot rendered on the right (e.g. "Post to GitHub"). */
  action?: React.ReactNode;
}

/**
 * GitHub-style PR header. Always renders, even when there's no full review yet
 * or when the AI review has failed — that way the user can always see PR
 * metadata + state, and never gets stuck on a bare error page.
 *
 * Layout:
 *   [state pill]  [PR title]                                          [actions]
 *                 author wants to merge X commits into base from head
 *                 (optional description, clamped to 3 lines)
 */
export function PrPageHeader({ prId, pullRequest, repository, action }: PrPageHeaderProps) {
  const state: PullRequestState = pullRequest?.state ?? 'open';
  const rawTitle = pullRequest?.title?.trim() || `Pull request #${prId}`;
  // If the title already ends with the prId (placeholder or echoed), drop the
  // standalone "#prId" suffix so we don't render "Foo #3058 #3058".
  const titleAlreadyHasId = new RegExp(`#${prId}\\b`).test(rawTitle);
  const title = rawTitle;
  const author = pullRequest?.author?.trim() || 'unknown';
  const source = pullRequest?.sourceBranch?.trim();
  const target = pullRequest?.targetBranch?.trim();
  const description = pullRequest?.description?.trim();
  const externalUrl = pullRequest?.prUrl ?? repository?.repoUrl;
  const providerLabel = repository?.provider ?? 'github';

  return (
    <header className="mb-6 border-b border-gh-border-muted pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <StatePill state={state} />
            <h1 className="text-xl font-semibold tracking-tight text-gh-text break-words">
              {title}
              {!titleAlreadyHasId && (
                <span className="text-gh-text-muted font-normal"> #{prId}</span>
              )}
            </h1>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gh-text-muted">
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span className="text-gh-text font-medium">{author}</span>
            </span>
            <span>opened this pull request</span>
            {source && target && (
              <>
                <span className="text-gh-text-subtle">·</span>
                <span className="inline-flex items-center gap-1.5">
                  wants to merge into
                  <code className="px-1.5 py-0.5 rounded bg-gh-surface border border-gh-border-muted text-xs font-mono text-gh-text">
                    {target}
                  </code>
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-gh-text-muted">from</span>
                  <code className="px-1.5 py-0.5 rounded bg-gh-surface border border-gh-border-muted text-xs font-mono text-gh-text">
                    {source}
                  </code>
                </span>
              </>
            )}
            {pullRequest && (
              <>
                <span className="text-gh-text-subtle">·</span>
                <span>
                  +{pullRequest.additions} −{pullRequest.deletions}{' '}
                  {pullRequest.filesChanged > 0 && (
                    <>
                      across {pullRequest.filesChanged} file
                      {pullRequest.filesChanged === 1 ? '' : 's'}
                    </>
                  )}
                </span>
              </>
            )}
          </div>

          {description && (
            <p className="mt-3 max-w-3xl text-sm text-gh-text whitespace-pre-line line-clamp-3">
              {description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {action}
          {externalUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={externalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                View on {providerLabel}
              </a>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
function StatePill({ state }: { state: PullRequestState }) {
  if (state === 'merged') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gh-purple/50 bg-gh-purple/15 px-2.5 py-1 text-xs font-semibold text-gh-purple shrink-0">
        <GitMerge className="h-3.5 w-3.5" />
        Merged
      </span>
    );
  }
  if (state === 'closed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gh-red/50 bg-gh-red/15 px-2.5 py-1 text-xs font-semibold text-[#f85149] shrink-0">
        <X className="h-3.5 w-3.5" />
        Closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gh-accent/60 bg-gh-accent/15 px-2.5 py-1 text-xs font-semibold text-[#3fb950] shrink-0">
      <GitPullRequest className="h-3.5 w-3.5" />
      Open
    </span>
  );
}

