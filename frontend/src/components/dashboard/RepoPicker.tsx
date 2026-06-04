'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, FolderGit2, GitBranch, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RepositoryRecord } from '@/types';

interface RepoPickerProps {
  repositories: RepositoryRecord[];
  selectedId: string | null;
  onSelect: (repo: RepositoryRecord) => void;
}

/**
 * Compact repo picker styled like the rest of the GH-themed UI. Shows the
 * active repo on the trigger, a search box inside the popover, and the
 * provider's org/workspace as a subtle secondary label per row.
 */
export function RepoPicker({ repositories, selectedId, onSelect }: RepoPickerProps) {
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

  const selected = useMemo(
    () => repositories.find((r) => r.id === selectedId) ?? null,
    [repositories, selectedId],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repositories;
    return repositories.filter(
      (r) =>
        r.repoName.toLowerCase().includes(q) ||
        r.orgOrWorkspace.toLowerCase().includes(q),
    );
  }, [repositories, query]);

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="min-w-[220px] justify-between"
      >
        <span className="flex items-center gap-2 min-w-0">
          <GitBranch className="h-3.5 w-3.5 text-gh-text-subtle shrink-0" />
          <span className="truncate">
            {selected
              ? `${selected.orgOrWorkspace} / ${selected.repoName}`
              : 'Select a repository'}
          </span>
        </span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </Button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-[320px] rounded-md border border-gh-border bg-gh-surface shadow-lg">
          <div className="border-b border-gh-border-muted p-2">
            <div className="flex items-center gap-2 rounded border border-gh-border bg-gh-canvas px-2 py-1">
              <Search className="h-3 w-3 text-gh-text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter repositories…"
                autoFocus
                className="flex-1 bg-transparent text-[12px] text-gh-text placeholder:text-gh-text-subtle outline-none"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-auto py-1">
            {visible.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gh-text-muted">
                {repositories.length === 0
                  ? 'No repositories connected yet.'
                  : 'No repositories match your search.'}
              </div>
            ) : (
              visible.map((repo) => {
                const isSelected = repo.id === selectedId;
                return (
                  <button
                    key={repo.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(repo);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-gh-surface-2',
                      isSelected ? 'text-gh-text' : 'text-gh-text',
                    )}
                  >
                    <FolderGit2 className="h-3.5 w-3.5 text-gh-text-subtle shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{repo.repoName}</div>
                      <div className="truncate text-[11px] text-gh-text-muted">
                        {repo.orgOrWorkspace}
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-[#3fb950]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
