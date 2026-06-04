import * as React from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-[1px] text-[11px] font-medium transition-colors',
        variant === 'default' &&
          'border-gh-accent-hover bg-gh-accent/20 text-[#3fb950]',
        variant === 'secondary' &&
          'border-gh-border-muted bg-gh-border-muted text-gh-text-muted',
        variant === 'destructive' &&
          'border-gh-red/60 bg-gh-red/20 text-[#f85149]',
        variant === 'outline' &&
          'border-gh-border bg-transparent text-gh-text-muted',
        className,
      )}
      {...props}
    />
  );
}
