'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { AppShell } from '@/components/layout/Sidebar';
import { Spinner } from '@/components/shared/PageHeader';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Defer auth/layout until after mount so server HTML matches the first client paint.
  // `isAuthenticated()` reads localStorage, which is always false on the server.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gh-canvas">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
