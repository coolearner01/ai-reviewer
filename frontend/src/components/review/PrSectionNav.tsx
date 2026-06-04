'use client';

import { useEffect, useState } from 'react';
import { cn, severityColors } from '@/lib/utils';
import { X, FileCode2, ListTree, AlertOctagon, BarChart3 } from 'lucide-react';
import type { Severity } from '@/types';

export interface SectionNavItem {
  id: string;
  label: string;
  count?: number;
  icon?: 'summary' | 'files' | 'findings' | 'risk';
}

const ICONS = {
  summary: ListTree,
  files: FileCode2,
  findings: AlertOctagon,
  risk: BarChart3,
};

/**
 * Sticky scrollspy nav for the PR review page.
 *
 * Renders pill links to each section + a row of clickable severity chips that
 * filter the findings panel. Highlights the section currently in view by
 * observing the corresponding anchor element with IntersectionObserver.
 *
 * The whole bar sticks to the top of the scrollable `<main>` (the AppShell
 * uses overflow-y-auto on `<main>` for the scroll container).
 */
export function PrSectionNav({
  sections,
  severityCounts,
  selectedSeverity,
  onSelectSeverity,
  activeFileFilter,
  onClearFileFilter,
}: {
  sections: SectionNavItem[];
  severityCounts: Record<Severity, number>;
  selectedSeverity: Severity | null;
  onSelectSeverity: (s: Severity | null) => void;
  /** When set, render a small "filtered by file" chip alongside the severity row. */
  activeFileFilter?: string | null;
  onClearFileFilter?: () => void;
}) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '');

  useEffect(() => {
    if (typeof window === 'undefined' || sections.length === 0) return;

    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    // Pick the section whose top is closest to (but past) the sticky nav.
    const observer = new IntersectionObserver(
      (entries) => {
        // Maintain a map of intersection ratios to pick the most-visible one.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActive(visible[0].target.id);
        }
      },
      {
        // Trigger when the section enters the band just below the sticky nav.
        rootMargin: '-80px 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [sections]);

  const handleJump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    // Offset so the section title isn't hidden under the sticky bar.
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
  const totalFindings = SEVERITIES.reduce((n, s) => n + (severityCounts[s] ?? 0), 0);

  return (
    <div
      className={cn(
        'sticky top-0 z-20 -mx-6 lg:-mx-8 px-6 lg:px-8',
        'bg-gh-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-gh-canvas/70',
        'border-b border-gh-border-muted',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 py-2.5">
        {/* Section pills */}
        <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
          {sections.map((section) => {
            const Icon = section.icon ? ICONS[section.icon] : null;
            const isActive = active === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => handleJump(section.id)}
                className={cn(
                  'group relative inline-flex items-center gap-1.5 whitespace-nowrap',
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
                  isActive
                    ? 'border-gh-blue/50 bg-gh-blue/10 text-gh-blue-muted'
                    : 'border-transparent text-gh-text-muted hover:text-gh-text hover:bg-gh-surface-2',
                )}
                aria-current={isActive ? 'true' : undefined}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                <span>{section.label}</span>
                {typeof section.count === 'number' && section.count > 0 && (
                  <span
                    className={cn(
                      'ml-0.5 inline-flex items-center justify-center rounded-full px-1.5 py-0 text-[10px] font-semibold',
                      isActive
                        ? 'bg-gh-blue/20 text-gh-blue-muted'
                        : 'bg-gh-surface text-gh-text-muted group-hover:bg-gh-surface-2',
                    )}
                  >
                    {section.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {/* Active file chip */}
          {activeFileFilter && (
            <button
              type="button"
              onClick={onClearFileFilter}
              title="Clear file filter"
              className="inline-flex items-center gap-1 rounded-full border border-gh-blue/40 bg-gh-blue/10 px-2 py-0.5 text-[11px] text-gh-blue-muted hover:bg-gh-blue/20"
            >
              <FileCode2 className="h-3 w-3" />
              <span className="font-mono max-w-[14ch] truncate">{activeFileFilter}</span>
              <X className="h-3 w-3" />
            </button>
          )}

          {/* Severity chips */}
          {totalFindings > 0 && (
            <>
              <button
                type="button"
                onClick={() => onSelectSeverity(null)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                  selectedSeverity === null
                    ? 'border-gh-text-muted bg-gh-surface-2 text-gh-text'
                    : 'border-gh-border text-gh-text-muted hover:bg-gh-surface-2',
                )}
              >
                All
                <span className="text-[10px] opacity-70">{totalFindings}</span>
              </button>
              {SEVERITIES.map((s) => {
                const count = severityCounts[s] ?? 0;
                if (count === 0) return null;
                const isActive = selectedSeverity === s;
                const c = severityColors[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSelectSeverity(isActive ? null : s)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize transition-colors',
                      c.badge,
                      isActive
                        ? 'ring-1 ring-offset-0 ring-current'
                        : 'opacity-70 hover:opacity-100',
                    )}
                    title={`Show only ${s} findings`}
                  >
                    <span className={cn('inline-block h-1.5 w-1.5 rounded-full', c.dot)} />
                    {s}
                    <span className="text-[10px] opacity-70">{count}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
