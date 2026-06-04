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
import { createPortal } from 'react-dom';

/**
 * Portal-based slot for the sticky top bar.
 *
 * Pages render `<TopBarActions>...</TopBarActions>` and
 * `<TopBarBreadcrumb>...</TopBarBreadcrumb>` anywhere in their JSX, and the
 * `<TopBar>` (rendered by `AppShell`) hosts the actual DOM portals.
 *
 * Going through portals avoids the `setState`-each-render re-render loop that
 * a naive context+useState slot would cause (pages pass fresh JSX every render).
 *
 * A tiny consumer counter (incremented on mount, decremented on unmount) lets
 * the host decide whether to fall back to its auto-generated breadcrumb.
 */
interface TopBarSlotValue {
  actionsHost: HTMLDivElement | null;
  setActionsHost: (node: HTMLDivElement | null) => void;
  breadcrumbHost: HTMLDivElement | null;
  setBreadcrumbHost: (node: HTMLDivElement | null) => void;
  hasBreadcrumb: boolean;
  registerBreadcrumb: () => () => void;
}

const TopBarSlotContext = createContext<TopBarSlotValue | null>(null);

export function TopBarSlotProvider({ children }: { children: ReactNode }) {
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null);
  const [breadcrumbHost, setBreadcrumbHost] = useState<HTMLDivElement | null>(null);
  const [breadcrumbCount, setBreadcrumbCount] = useState(0);

  const registerBreadcrumb = useCallback(() => {
    setBreadcrumbCount((n) => n + 1);
    return () => setBreadcrumbCount((n) => Math.max(0, n - 1));
  }, []);

  const value = useMemo<TopBarSlotValue>(
    () => ({
      actionsHost,
      setActionsHost,
      breadcrumbHost,
      setBreadcrumbHost,
      hasBreadcrumb: breadcrumbCount > 0,
      registerBreadcrumb,
    }),
    [actionsHost, breadcrumbHost, breadcrumbCount, registerBreadcrumb],
  );

  return <TopBarSlotContext.Provider value={value}>{children}</TopBarSlotContext.Provider>;
}

function useTopBarSlot(): TopBarSlotValue {
  const ctx = useContext(TopBarSlotContext);
  if (!ctx) throw new Error('TopBar slot used outside <TopBarSlotProvider>');
  return ctx;
}

/** Renders its children into the sticky top bar's action area on the right. */
export function TopBarActions({ children }: { children: ReactNode }) {
  const { actionsHost } = useTopBarSlot();
  if (!actionsHost) return null;
  return createPortal(children, actionsHost);
}

/**
 * Replaces the auto-built breadcrumb. While mounted, the host suppresses its
 * default breadcrumb (driven by the URL).
 */
export function TopBarBreadcrumb({ children }: { children: ReactNode }) {
  const { breadcrumbHost, registerBreadcrumb } = useTopBarSlot();
  useEffect(() => registerBreadcrumb(), [registerBreadcrumb]);
  if (!breadcrumbHost) return null;
  return createPortal(children, breadcrumbHost);
}

/**
 * Renders the host nodes for the actions + breadcrumb portals.
 * `fallback` shows up when no page has supplied a custom breadcrumb.
 */
export function TopBarSlotHosts({ fallback }: { fallback: ReactNode }) {
  const { setActionsHost, setBreadcrumbHost, hasBreadcrumb } = useTopBarSlot();
  return (
    <>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <div ref={setBreadcrumbHost} className="contents" />
        {!hasBreadcrumb && fallback}
      </div>
      <div className="ml-auto flex items-center gap-2" ref={setActionsHost} />
    </>
  );
}
