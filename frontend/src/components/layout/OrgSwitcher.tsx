'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import { useActiveOrg } from '@/lib/hooks/useActiveOrg';

export function OrgSwitcher() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { organizations, activeOrg, setActiveOrgId } = useActiveOrg();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!switcherOpen) return;
    const onClick = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [switcherOpen]);

  useEffect(() => setSwitcherOpen(false), [pathname]);

  return (
    <div className="relative" ref={switcherRef}>
      <button
        type="button"
        onClick={() => setSwitcherOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-gh-border bg-gh-surface px-2 py-1.5 hover:border-gh-text-subtle transition-colors"
        aria-haspopup="listbox"
        aria-expanded={switcherOpen}
      >
        <div className="h-5 w-5 rounded bg-[#2a3a2a] flex items-center justify-center text-[10px] font-bold text-[#4ade80]">
          {(activeOrg?.name ?? user?.name ?? 'A').slice(0, 1).toUpperCase()}
        </div>
        <span className="flex-1 truncate text-left text-[13px] text-gh-text">
          {activeOrg?.name ?? 'No organization'}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-gh-text-muted transition-transform',
            switcherOpen && 'rotate-180',
          )}
        />
      </button>

      {switcherOpen && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-gh-border bg-gh-surface shadow-xl"
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {organizations.length === 0 && (
              <p className="px-3 py-2 text-xs text-gh-text-muted">No organizations yet.</p>
            )}
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  setActiveOrgId(org.id);
                  setSwitcherOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors',
                  org.id === activeOrg?.id
                    ? 'bg-gh-blue/10 text-gh-blue-muted'
                    : 'text-gh-text hover:bg-gh-border-muted',
                )}
                role="option"
                aria-selected={org.id === activeOrg?.id}
              >
                <div className="h-5 w-5 rounded bg-[#2a3a2a] flex items-center justify-center text-[10px] font-bold text-[#4ade80] shrink-0">
                  {org.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="flex-1 truncate">{org.name}</span>
                <span className="text-[10px] uppercase text-gh-text-subtle">{org.provider}</span>
                {org.id === activeOrg?.id && <Check className="h-3 w-3 text-gh-blue-muted" />}
              </button>
            ))}
          </div>
          <div className="border-t border-gh-border-muted">
            <Link
              href="/organizations/new"
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gh-blue-muted hover:bg-gh-border-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              New organization
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
