'use client';

import { useEffect } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  /** Heading shown at the top of the dialog. */
  title: string;
  /** Body copy explaining the consequence of the action. */
  description: React.ReactNode;
  /** Label for the confirm button (e.g. "Delete"). */
  confirmLabel: string;
  /** Label shown on the confirm button while the action is running. */
  pendingLabel?: string;
  /** Cancel/dismiss button label. */
  cancelLabel?: string;
  /** Visual tone — `danger` (red) for destructive actions, `default` otherwise. */
  tone?: 'danger' | 'default';
  /** Disables buttons and shows a spinner on confirm while true. */
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Reusable confirmation modal. Matches the app's dark dialog styling
 * (see ReviewConfirmDialog / PromptFormDialog) and is used for destructive
 * actions like deleting or cancelling a review.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  pending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, pending]);

  const isDanger = tone === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
        onClick={() => !pending && onClose()}
        aria-hidden
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-gh-border bg-gh-canvas shadow-2xl">
        <div className="flex items-start gap-3 border-b border-gh-border px-5 py-4">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              isDanger ? 'bg-gh-red/15 text-gh-red' : 'bg-gh-surface-2 text-gh-text-muted',
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-gh-text">
              {title}
            </h2>
            <div className="mt-0.5 text-xs text-gh-text-muted">{description}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md p-1 text-gh-text-subtle transition-colors hover:bg-gh-surface-2 hover:text-gh-text disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gh-border bg-gh-surface/40 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDanger ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
