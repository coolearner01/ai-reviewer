'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GitPullRequest } from 'lucide-react';
import { isAuthenticated } from '@/lib/auth';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gh-canvas p-4">
      <div className="flex items-center gap-2 mb-6 text-gh-text">
        <div className="h-8 w-8 rounded-md bg-gh-accent flex items-center justify-center text-white">
          <GitPullRequest className="h-4 w-4" />
        </div>
        <span className="text-lg font-semibold">ReviewBot</span>
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-6 text-xs text-gh-text-subtle">
        AI-powered pull request reviews.
      </p>
    </div>
  );
}
