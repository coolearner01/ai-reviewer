'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { AuthProvider } from '@/lib/hooks/useAuth';
import { ActiveOrgProvider } from '@/lib/hooks/useActiveOrg';
import { TopBarSlotProvider } from '@/components/layout/TopBarActions';

/**
 * Single client boundary for all React context providers.
 *
 * Next.js root layouts are Server Components; wrapping providers in one
 * `'use client'` module ensures context propagates to every route segment
 * (including /simulate and the Sidebar inside AppShell).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ActiveOrgProvider>
          <TopBarSlotProvider>
            {children}
            <Toaster position="top-right" richColors theme="dark" />
          </TopBarSlotProvider>
        </ActiveOrgProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
