import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  className,
  action,
}: {
  title: string;
  description?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-gh-border-muted pb-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-gh-text">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gh-text-muted">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-5 w-5 animate-spin rounded-full border-2 border-gh-border border-t-gh-blue-muted',
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-gh-border bg-gh-surface/40 py-16 text-center">
      <p className="text-base font-medium text-gh-text">{title}</p>
      {description && (
        <p className="mt-2 max-w-md text-sm text-gh-text-muted">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-md border border-gh-red/50 bg-gh-red/10 p-5 text-center">
      <p className="text-sm text-[#f85149]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-sm font-medium text-[#f85149] underline hover:no-underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}
