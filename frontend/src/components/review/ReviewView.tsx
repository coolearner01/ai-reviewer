'use client';

import type { ReactNode } from 'react';
import type { ReviewResult } from '@/types';
import { InteractiveReviewView } from './InteractiveReviewView';
import { ReviewDetailContent } from './ReviewDetailContent';

export type ReviewViewLayout = 'tabs' | 'sections';

export interface ReviewViewProps {
  data: ReviewResult;
  refetch: () => void;
  layout?: ReviewViewLayout;
  breadcrumb?: ReactNode;
  hidePageHeader?: boolean;
  hideBreadcrumb?: boolean;
}

/**
 * Unified review detail surface — tabs (legacy /review/:id) or sections (org PR URL).
 */
export function ReviewView({
  layout = 'tabs',
  data,
  refetch,
  breadcrumb,
  hidePageHeader,
  hideBreadcrumb,
}: ReviewViewProps) {
  if (layout === 'sections') {
    return (
      <ReviewDetailContent
        data={data}
        refetch={refetch}
        breadcrumb={breadcrumb}
        hidePageHeader={hidePageHeader}
        hideBreadcrumb={hideBreadcrumb}
      />
    );
  }
  return <InteractiveReviewView data={data} refetch={refetch} />;
}
