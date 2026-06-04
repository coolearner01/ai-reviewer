'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AGENT_OPTIONS, REVIEW_DEPTH_OPTIONS } from '@/lib/constants/reviewSettings';
import type { AgentType, ReviewDepth } from '@/types';

export function ReviewDepthPicker({
  value,
  onChange,
}: {
  value: ReviewDepth;
  onChange: (d: ReviewDepth) => void;
}) {
  return (
    <div>
      <Label>Default review depth</Label>
      <div className="flex gap-2 mt-2">
        {REVIEW_DEPTH_OPTIONS.map(({ value: d, label }) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={cn(
              'flex-1 rounded-md border px-4 py-2 text-sm capitalize transition-colors',
              value === d
                ? 'border-gh-blue bg-gh-blue/10 text-gh-blue-muted'
                : 'border-gh-border bg-gh-surface text-gh-text-muted hover:border-gh-text-subtle hover:text-gh-text',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FocusAreasPicker({
  value,
  onChange,
}: {
  value: AgentType[];
  onChange: (next: AgentType[]) => void;
}) {
  return (
    <div>
      <Label>Default focus areas</Label>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {AGENT_OPTIONS.map(({ value: agent, label }) => (
          <label key={agent} className="flex items-center gap-2 text-sm text-gh-text">
            <input
              type="checkbox"
              checked={value.includes(agent)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, agent]
                    : value.filter((v) => v !== agent),
                )
              }
              className="accent-gh-blue"
            />
            {label}
          </label>
        ))}
      </div>
      <p className="text-xs text-gh-text-muted mt-2">
        Empty = run all agents. Selected items narrow the run.
      </p>
    </div>
  );
}

export function IgnoredPathsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor="ignored-paths">Ignored paths</Label>
      <Input
        id="ignored-paths"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="migrations/, __tests__/, *.md"
        className="mt-1.5"
      />
      <p className="text-xs text-gh-text-muted mt-1">Comma-separated path prefixes</p>
    </div>
  );
}

export function CustomInstructionsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label htmlFor="custom-instructions">Default custom instructions</Label>
      <textarea
        id="custom-instructions"
        rows={4}
        className="mt-1.5 w-full rounded-md border border-gh-border bg-gh-surface px-3 py-2 text-sm text-gh-text placeholder:text-gh-text-subtle focus:outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Focus on database transaction safety…"
      />
    </div>
  );
}

