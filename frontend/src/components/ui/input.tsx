import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-8 w-full rounded-md border border-gh-border bg-gh-surface px-2.5 py-1.5 text-[13px] text-gh-text',
        'placeholder:text-gh-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-gh-blue',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
