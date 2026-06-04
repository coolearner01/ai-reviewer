'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CountedOption {
  name: string;
  count: number;
}

/**
 * Build a sorted, counted option list from a flat array. Empty / whitespace
 * values are skipped. Most frequent first, then alphabetic.
 */
export function buildCountedOptions<T>(
  items: T[],
  pick: (item: T) => string | undefined | null,
): CountedOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = pick(item)?.trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

interface MultiSelectFilterProps {
  label: string;
  options: CountedOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
}

/**
 * Generic GitHub-style multi-select dropdown for filtering tables (Author,
 * Repo, Status, etc). Renders as a `Button` with a popover; closes on
 * outside click, supports inline search, shows per-option counts, and a
 * "Clear selection" footer when anything is picked.
 */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  emptyHint,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const toggle = (name: string) => {
    onChange(
      selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name],
    );
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {label}
        {selected.length > 0 && (
          <span className="ml-1 rounded-full bg-gh-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-gh-text">
            {selected.length}
          </span>
        )}
        <ChevronDown className="h-3 w-3 opacity-70" />
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-md border border-gh-border bg-gh-surface shadow-lg">
          <div className="border-b border-gh-border-muted p-2">
            <div className="flex items-center gap-2 rounded border border-gh-border bg-gh-canvas px-2 py-1">
              <Search className="h-3 w-3 text-gh-text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Filter ${label.toLowerCase()}s…`}
                autoFocus
                className="flex-1 bg-transparent text-[12px] text-gh-text placeholder:text-gh-text-subtle outline-none"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {visible.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gh-text-muted">
                {options.length === 0
                  ? (emptyHint ?? `No ${label.toLowerCase()}s available.`)
                  : `No ${label.toLowerCase()}s match your search.`}
              </div>
            ) : (
              visible.map((opt) => {
                const checked = selected.includes(opt.name);
                return (
                  <button
                    key={opt.name}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => toggle(opt.name)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-gh-text hover:bg-gh-surface-2"
                  >
                    <span
                      className={cn(
                        'flex h-3.5 w-3.5 items-center justify-center rounded border',
                        checked
                          ? 'border-gh-accent bg-gh-accent text-white'
                          : 'border-gh-border bg-gh-canvas',
                      )}
                    >
                      {checked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="flex-1 truncate">{opt.name}</span>
                    <span className="text-[11px] text-gh-text-subtle">{opt.count}</span>
                  </button>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-gh-border-muted p-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded px-2 py-1 text-left text-xs text-gh-text-muted hover:bg-gh-surface-2 hover:text-gh-text"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Small removable chip used to display an active filter. */
export function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gh-border bg-gh-surface px-2 py-0.5">
      {label}: <span className="text-gh-text">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} ${value}`}
        className="text-gh-text-subtle hover:text-gh-text"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
