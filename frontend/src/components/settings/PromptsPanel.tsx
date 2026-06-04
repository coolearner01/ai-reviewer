'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner, ErrorCard } from '@/components/shared/PageHeader';
import {
  useCreatePrompt,
  useDeletePrompt,
  usePrompts,
  useUpdatePrompt,
} from '@/lib/hooks/usePrompts';
import { PromptFormDialog } from './PromptFormDialog';
import type { ReviewPrompt } from '@/lib/api/prompts';

export function PromptsPanel() {
  const { data, isLoading, error, refetch } = usePrompts();
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const deletePrompt = useDeletePrompt();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }
  if (error) {
    return <ErrorCard message={error.message} onRetry={() => refetch()} />;
  }

  const prompts = data?.prompts ?? [];

  return (
    <Card>
      <CardContent className="pt-5 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-gh-text-muted">
            Check the prompts the AI should consider while reviewing. Every{' '}
            <strong className="text-gh-text">enabled</strong> prompt is injected into each review.
          </p>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New prompt
          </Button>
        </div>

        {prompts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gh-border bg-gh-surface/40 px-4 py-10 text-center">
            <p className="text-sm text-gh-text-muted">No prompts yet.</p>
            <p className="mt-1 text-xs text-gh-text-subtle">
              Click “New prompt” to add one — it’ll show up here as a checkbox.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {prompts.map((prompt) => (
              <PromptRow
                key={prompt.id}
                prompt={prompt}
                onToggle={(enabled) =>
                  updatePrompt.mutate({ id: prompt.id, patch: { enabled } })
                }
                onDelete={() => deletePrompt.mutate(prompt.id)}
                deleting={deletePrompt.isPending && deletePrompt.variables === prompt.id}
              />
            ))}
          </ul>
        )}
      </CardContent>

      {dialogOpen && (
        <PromptFormDialog
          saving={createPrompt.isPending}
          onClose={() => setDialogOpen(false)}
          onSubmit={(values) =>
            createPrompt.mutate(values, { onSuccess: () => setDialogOpen(false) })
          }
        />
      )}
    </Card>
  );
}

function PromptRow({
  prompt,
  onToggle,
  onDelete,
  deleting,
}: {
  prompt: ReviewPrompt;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-gh-border bg-gh-surface px-3 py-2.5">
      <input
        type="checkbox"
        checked={prompt.enabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="mt-0.5 accent-gh-blue"
        aria-label={`Enable ${prompt.label}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gh-text">{prompt.label}</p>
        <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-gh-text-muted">
          {prompt.content}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="rounded-md p-1.5 text-gh-text-subtle transition-colors hover:bg-gh-surface-2 hover:text-gh-red disabled:opacity-50"
        aria-label={`Delete ${prompt.label}`}
      >
        {deleting ? (
          <Spinner className="h-3.5 w-3.5" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </li>
  );
}
