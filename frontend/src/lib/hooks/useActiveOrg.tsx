'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '@/lib/api/organizations';
import { queryKeys } from '@/lib/queryKeys';
import type { OrganizationRecord } from '@/types';

/**
 * Tracks the user's currently selected organization across the app.
 *
 * Persisted to localStorage so the choice survives navigations and reloads.
 * Falls back to the first org in the list when nothing is stored (or when the
 * stored id no longer exists).
 */

const STORAGE_KEY = 'pr-reviewer:active-org-id';

interface ActiveOrgContextValue {
  organizations: OrganizationRecord[];
  activeOrg: OrganizationRecord | null;
  setActiveOrgId: (id: string) => void;
  isLoading: boolean;
  refetch: () => void;
}

const ActiveOrgContext = createContext<ActiveOrgContextValue | null>(null);

function readStoredId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function ActiveOrgProvider({ children }: { children: ReactNode }) {
  const orgsQuery = useQuery({
    queryKey: queryKeys.organizations,
    queryFn: () => organizationsApi.list(),
    staleTime: 60_000,
  });

  const organizations = useMemo(
    () => orgsQuery.data?.organizations ?? [],
    [orgsQuery.data],
  );

  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);

  // Hydrate from localStorage after mount (server renders no orgs).
  useEffect(() => {
    setActiveOrgIdState(readStoredId());
  }, []);

  // Whenever the org list refreshes, normalize the selected id.
  useEffect(() => {
    if (organizations.length === 0) {
      if (activeOrgId !== null) {
        setActiveOrgIdState(null);
        writeStoredId(null);
      }
      return;
    }
    const exists = organizations.some((o) => o.id === activeOrgId);
    if (!exists) {
      const fallback = organizations[0].id;
      setActiveOrgIdState(fallback);
      writeStoredId(fallback);
    }
  }, [organizations, activeOrgId]);

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id);
    writeStoredId(id);
  }, []);

  const activeOrg = useMemo(
    () => organizations.find((o) => o.id === activeOrgId) ?? null,
    [organizations, activeOrgId],
  );

  const value: ActiveOrgContextValue = {
    organizations,
    activeOrg,
    setActiveOrgId,
    isLoading: orgsQuery.isLoading,
    refetch: () => void orgsQuery.refetch(),
  };

  return <ActiveOrgContext.Provider value={value}>{children}</ActiveOrgContext.Provider>;
}

export function useActiveOrg(): ActiveOrgContextValue {
  const ctx = useContext(ActiveOrgContext);
  if (!ctx) throw new Error('useActiveOrg must be used within ActiveOrgProvider');
  return ctx;
}
