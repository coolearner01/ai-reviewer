'use client';

import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface NavItemProps {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  count?: number;
}

export function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-4 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-gh-text-subtle">
        {label}
      </p>
      <ul className="space-y-px px-1.5">{children}</ul>
    </div>
  );
}

export function NavItem({ href, label, icon: Icon, active, count }: NavItemProps) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors',
          active
            ? 'bg-[#1c2c3a] text-[#7ab8f5]'
            : 'text-gh-text-muted hover:bg-gh-border-muted hover:text-gh-text',
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        {count !== undefined && (
          <span
            className={cn(
              'rounded-full px-1.5 text-[10px] font-medium',
              active
                ? 'bg-[#1a3a5a] text-[#7ab8f5]'
                : 'bg-[#1e3a1e] text-[#4ade80]',
            )}
          >
            {count}
          </span>
        )}
      </Link>
    </li>
  );
}
