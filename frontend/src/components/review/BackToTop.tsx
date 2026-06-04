'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Floating "back to top" button. Appears after the user scrolls past `offset`
 * inside the nearest scroll container (or the window). Designed for the
 * AppShell layout where `<main>` is the actual scroll container.
 */
export function BackToTop({ offset = 600 }: { offset?: number }) {
  const [visible, setVisible] = useState(false);
  const [scroller, setScroller] = useState<HTMLElement | Window | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Locate the scroll container — AppShell renders <main class="flex-1 overflow-y-auto">.
    const main = document.querySelector('main');
    const target: HTMLElement | Window = main ?? window;
    setScroller(target);

    const read = () => {
      const y =
        target === window
          ? window.scrollY
          : (target as HTMLElement).scrollTop;
      setVisible(y > offset);
    };
    read();
    target.addEventListener('scroll', read, { passive: true });
    return () => target.removeEventListener('scroll', read);
  }, [offset]);

  const scrollToTop = () => {
    if (!scroller) return;
    if (scroller === window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      (scroller as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      className={cn(
        'fixed bottom-6 right-6 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full',
        'border border-gh-border bg-gh-surface-2 text-gh-text shadow-lg',
        'hover:bg-gh-canvas hover:border-gh-blue/50 hover:text-gh-blue-muted',
        'transition-all duration-200',
        visible ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2',
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
