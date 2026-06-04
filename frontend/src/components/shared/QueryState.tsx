'use client';

import type { ReactNode } from 'react';
import { Spinner, ErrorCard, EmptyState } from '@/components/shared/PageHeader';

interface QueryStateProps {
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Standard loading / error / empty wrapper for data pages.
 */
export function QueryState({
  isLoading,
  error,
  onRetry,
  isEmpty,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  children,
  className = 'px-6 py-8 max-w-7xl mx-auto',
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div className={`flex justify-center py-20 ${className}`}>
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (error) {
    return (
      <div className={className}>
        <ErrorCard message={error.message} onRetry={onRetry} />
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className={className}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }
  return <>{children}</>;
}
