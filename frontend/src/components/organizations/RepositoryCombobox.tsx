'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Loader2, Lock, Search } from 'lucide-react';
import { organizationsApi } from '@/lib/api/organizations';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ProviderRepositorySuggestion } from '@/types';

interface RepositoryComboboxProps {
  organizationId: string | undefined;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (repo: ProviderRepositorySuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Returns the input value debounced by `delayMs`. */
function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function RepositoryCombobox({
  organizationId,
  value,
  onChange,
  onSelect,
  placeholder = 'my-app or owner/my-app',
  disabled,
}: RepositoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const debouncedQuery = useDebounced(value, 250);

  const enabled = Boolean(organizationId);
  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['organization-provider-repos', organizationId, debouncedQuery],
    queryFn: () =>
      organizationsApi.searchProviderRepositories(organizationId!, {
        query: debouncedQuery.trim() || undefined,
        limit: 20,
      }),
    enabled,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const suggestions = useMemo(() => data?.repositories ?? [], [data]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery, suggestions.length]);

  const choose = (repo: ProviderRepositorySuggestion) => {
    onChange(repo.fullName);
    onSelect?.(repo);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && suggestions[activeIndex]) {
      e.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Keep the dropdown open whenever the input is focused and we have a
  // disabled-aware reason to render something — including the "no results"
  // and "no token access" states. Otherwise an empty success response
  // would silently close the picker and look like nothing happened.
  const showDropdown = open && enabled && (isFetching || isError || Boolean(data));

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gh-text-subtle" />
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="pl-7 pr-7"
        />
        {isFetching && enabled && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-gh-text-subtle" />
        )}
      </div>

      {showDropdown && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-md border border-gh-border bg-gh-surface shadow-lg"
        >
          {data?.supported === false && (
            <div className="px-3 py-2 text-xs text-gh-text-muted">
              Auto-suggestions aren&apos;t supported for this provider yet — type a repo name to continue.
            </div>
          )}

          {isError && (
            <div className="px-3 py-2 text-xs text-gh-red">
              {(error as Error)?.message ?? 'Failed to load repositories'}
            </div>
          )}

          {!isError && data?.error && (
            <div className="px-3 py-2 text-xs text-gh-red leading-relaxed">{data.error}</div>
          )}

          {!isError &&
            !data?.error &&
            suggestions.length === 0 &&
            !isFetching &&
            data?.supported !== false && (
            <div className="px-3 py-2 text-xs text-gh-text-muted">
              {debouncedQuery.trim()
                ? `No repositories match "${debouncedQuery.trim()}".`
                : 'No repositories accessible with the saved token.'}
            </div>
          )}

          {suggestions.map((repo, idx) => {
            const isActive = idx === activeIndex;
            const isSelected = value.trim().toLowerCase() === repo.fullName.toLowerCase();
            return (
              <button
                key={repo.fullName}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => choose(repo)}
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                  isActive ? 'bg-gh-surface-2' : 'bg-transparent',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 truncate font-medium text-gh-text">
                    <span className="truncate">{repo.fullName}</span>
                    {repo.isPrivate && <Lock className="h-3 w-3 text-gh-text-subtle" />}
                  </div>
                  {repo.description && (
                    <p className="truncate text-xs text-gh-text-muted">{repo.description}</p>
                  )}
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-wider text-gh-text-subtle">
                    {repo.language && <span>{repo.language}</span>}
                    {repo.defaultBranch && <span className="font-mono">{repo.defaultBranch}</span>}
                  </div>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-[#3fb950]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
