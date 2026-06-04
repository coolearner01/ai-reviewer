'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/shared/PageHeader';

/**
 * API Keys now lives as a tab inside Settings. Keep this route as a redirect
 * so existing links/bookmarks land on the right place.
 */
export default function ApiKeysPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings?tab=api-keys');
  }, [router]);

  return (
    <div className="flex justify-center py-20">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
