'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PromptFormDialogProps {
  onClose: () => void;
  onSubmit: (values: { label: string; content: string }) => void;
  saving?: boolean;
}

/**
 * Small popup form to create a new review prompt. A label (shown as a checkbox
 * on the Prompts page) and the prompt content the model should consider.
 */
export function PromptFormDialog({ onClose, onSubmit, saving = false }: PromptFormDialogProps) {
  const [label, setLabel] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const canAdd = label.trim().length > 0 && content.trim().length > 0 && !saving;

  const handleAdd = () => {
    if (!canAdd) return;
    onSubmit({ label: label.trim(), content: content.trim() });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-form-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-gh-border bg-gh-canvas shadow-2xl">
        <div className="flex items-start gap-3 border-b border-gh-border px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gh-purple to-gh-blue text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="prompt-form-title" className="text-sm font-semibold text-gh-text">
              New review prompt
            </h2>
            <p className="mt-0.5 text-xs text-gh-text-muted">
              The label appears as a checkbox. When checked, its content is sent to the model on
              every review.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gh-text-subtle transition-colors hover:bg-gh-surface-2 hover:text-gh-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <Label htmlFor="prompt-label">Label</Label>
            <Input
              id="prompt-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Feature Development Conventions"
              className="mt-1.5"
              maxLength={120}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="prompt-content">Prompt</Label>
            <textarea
              id="prompt-content"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe what the AI should check for during reviews…"
              className="mt-1.5 w-full rounded-md border border-gh-border bg-gh-surface px-3 py-2 text-sm text-gh-text placeholder:text-gh-text-subtle focus:outline-none focus:ring-2 focus:ring-ring"
              maxLength={8000}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gh-border bg-gh-surface/40 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleAdd} disabled={!canAdd}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
