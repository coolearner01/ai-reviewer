'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bot,
  Building2,
  GitPullRequest,
  LogOut,
  Plus,
  Settings,
  Webhook,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/hooks/useAuth';
import { useActiveOrg } from '@/lib/hooks/useActiveOrg';
import { reviewsApi } from '@/lib/api/reviews';
import { orgPullsPath } from '@/lib/routes';
import { queryKeys } from '@/lib/queryKeys';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { OrgSwitcher } from '@/components/layout/OrgSwitcher';
import { NavItem, NavSection, type NavItemProps } from '@/components/layout/SidebarNav';
import { TopBarSlotHosts } from '@/components/layout/TopBarActions';

/**
 * GitHub-dark style left rail mirroring the reference mockup in
 * files/pr_reviewer_frontend_prompt.html.
 *
 * Sections:
 *  - Org switcher card at the top
 *  - OVERVIEW: Pull Requests · AI Reviews · Insights
 *  - ORGANIZATION: Settings · Webhooks · Organizations
 *  - REPOSITORIES: live list from the active org with colored dots and PR counts
 *  - User footer
 */
export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { activeOrg } = useActiveOrg();

  const { data: repoData } = useOrganization(activeOrg?.slug);

  // Pull a tiny page of reviews so the sidebar counts feel alive.
  const { data: reviewsData } = useQuery({
    queryKey: queryKeys.reviews({ sidebar: true }),
    queryFn: () => reviewsApi.list({ limit: 100 }),
    staleTime: 30_000,
  });

  const repositories = repoData?.repositories ?? [];

  const counts = useMemo(() => {
    const reviews = reviewsData?.reviews ?? [];
    let pulls = 0;
    let ai = 0;
    for (const r of repositories) pulls += r.openPrCount ?? 0;
    for (const r of reviews) if (r.review.status === 'completed') ai += 1;
    return { pulls, ai };
  }, [repositories, reviewsData]);

  const overviewNav: NavItemProps[] = [
    {
      href: '/dashboard',
      label: 'Pull Requests',
      icon: GitPullRequest,
      count: counts.pulls || undefined,
      active: pathname === '/dashboard',
    },
    {
      href: '/ai-reviews',
      label: 'AI Reviews',
      icon: Bot,
      count: counts.ai || undefined,
      active: pathname.startsWith('/ai-reviews'),
    },
    {
      href: '/insights',
      label: 'Insights',
      icon: BarChart3,
      active: pathname.startsWith('/insights'),
    },
  ];

  const orgNav: NavItemProps[] = [
    {
      href: '/settings',
      label: 'Settings',
      icon: Settings,
      active: pathname.startsWith('/settings'),
    },
    {
      href: '/webhooks',
      label: 'Webhooks',
      icon: Webhook,
      active: pathname.startsWith('/webhooks'),
    },
    {
      href: '/organizations',
      label: 'Organizations',
      icon: Building2,
      active: pathname.startsWith('/organizations'),
    },
  ];

  return (
    <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-gh-border bg-gh-sidebar h-screen">
      <div className="px-4 pt-4 pb-3 border-b border-gh-border-muted shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-md bg-[#1a3a1a] flex items-center justify-center text-[#4ade80]">
            <GitPullRequest className="h-4 w-4" />
          </div>
          <span className="text-[15px] font-semibold text-gh-text">ReviewBot</span>
        </Link>

        <OrgSwitcher />

        <Link
          href="/simulate"
          className="mt-2 flex items-center justify-center gap-1.5 rounded-md border border-[#2a3a2a] bg-[#1a2a1a] px-2 py-1.5 text-[12px] text-[#6ddf8a] hover:bg-[#1e441e] transition-colors"
        >
          <Zap className="h-3.5 w-3.5" />
          Simulate PR
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <NavSection label="Overview">
          {overviewNav.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </NavSection>

        <NavSection label="Organization">
          {orgNav.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
        </NavSection>

        <div className="mt-2 border-t border-gh-border-muted pt-2">
          <p className="px-4 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-gh-text-subtle">
            Repositories
          </p>
          <ul className="space-y-px px-1">
            {repositories.length === 0 && (
              <li className="px-3 py-1 text-xs text-gh-text-muted">
                {activeOrg ? 'No repos yet.' : 'Pick an organization first.'}
              </li>
            )}
            {repositories.slice(0, 8).map((repo) => (
              <li key={repo.id}>
                <Link
                  href={
                    activeOrg
                      ? orgPullsPath(activeOrg.slug, repo.repoName)
                      : '/repositories'
                  }
                  className="group flex items-center gap-2 rounded px-3 py-1 text-xs text-gh-text-muted hover:bg-gh-border-muted hover:text-gh-text"
                  title={repo.repoName}
                >
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      repoDot(repo.repoName),
                    )}
                  />
                  <span className="truncate flex-1">{repo.repoName}</span>
                  {repo.openPrCount !== undefined && repo.openPrCount > 0 && (
                    <span className="rounded-full bg-gh-border px-1.5 text-[10px] font-medium text-gh-text-muted">
                      {repo.openPrCount}
                    </span>
                  )}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={activeOrg ? `/organizations/${activeOrg.slug}` : '/organizations/new'}
                className="flex items-center gap-1.5 rounded px-3 py-1 text-xs text-gh-blue-muted hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add repository
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <div className="border-t border-gh-border-muted px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gh-purple flex items-center justify-center text-[11px] font-semibold text-white">
            {(user?.name ?? user?.email ?? 'U').slice(0, 2).toUpperCase()}
          </div>
          <span className="flex-1 truncate text-[13px] text-gh-text-muted">
            {user?.name ?? user?.email ?? 'You'}
          </span>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="text-gh-text-subtle hover:text-gh-text transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

const REPO_DOT_COLORS = [
  'bg-gh-yellow',
  'bg-gh-blue-muted',
  'bg-gh-orange',
  'bg-gh-purple',
  'bg-gh-accent',
] as const;

function repoDot(repoName: string): string {
  let hash = 0;
  for (let i = 0; i < repoName.length; i++) hash = (hash * 31 + repoName.charCodeAt(i)) | 0;
  return REPO_DOT_COLORS[Math.abs(hash) % REPO_DOT_COLORS.length];
}

/**
 * App shell: viewport-locked layout.
 *
 *  - Outer container: `h-screen overflow-hidden` so the page itself never
 *    scrolls.
 *  - Sidebar: `h-screen`, with its inner nav being the only scrollable
 *    region; the logo/org header at top and the user footer stay pinned.
 *  - Right column: fixed-height flex column. The `TopBar` keeps its natural
 *    height (h-12) and the `<main>` element gets `flex-1 overflow-y-auto` so
 *    only the page body scrolls under a permanently visible header.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-gh-canvas text-gh-text">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 h-full">
        <TopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function TopBar() {
  const pathname = usePathname();
  const { activeOrg } = useActiveOrg();

  const fallbackBreadcrumb = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    return (
      <nav className="flex items-center gap-1.5 text-[13px] text-gh-text-muted min-w-0">
        {activeOrg ? (
          <Link href="/dashboard" className="text-gh-blue-muted hover:underline">
            {activeOrg.name}
          </Link>
        ) : (
          <Link href="/dashboard" className="text-gh-blue-muted hover:underline">
            home
          </Link>
        )}
        {segments.map((seg, idx) => {
          const href = '/' + segments.slice(0, idx + 1).join('/');
          const isLast = idx === segments.length - 1;
          const label = labelFor(seg);
          return (
            <span key={href} className="flex items-center gap-1.5 min-w-0">
              <span className="text-gh-text-subtle">/</span>
              {isLast ? (
                <span className="truncate text-gh-text">{label}</span>
              ) : (
                <Link
                  href={href}
                  className="truncate text-gh-blue-muted hover:underline"
                >
                  {label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    );
  }, [pathname, activeOrg]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-gh-border bg-gh-canvas px-4">
      <TopBarSlotHosts fallback={fallbackBreadcrumb} />
    </header>
  );
}

/** Pretty path-segment labels for the breadcrumb. */
function labelFor(seg: string): string {
  const decoded = decodeURIComponent(seg);
  const map: Record<string, string> = {
    dashboard: 'Pull Requests',
    'ai-reviews': 'AI Reviews',
    insights: 'Insights',
    repositories: 'Repositories',
    organizations: 'Organizations',
    settings: 'Settings',
    webhooks: 'Webhooks',
    'api-keys': 'API Keys',
    review: 'Reviews',
    new: 'New',
    simulate: 'Simulate PR',
    pulls: 'Pull Requests',
  };
  return map[decoded] ?? decoded;
}
