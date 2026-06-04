'use client';

import { useParams } from 'next/navigation';
import { useReview } from '@/lib/hooks/useReview';
import { ReviewView } from '@/components/review/ReviewView';
import { ReviewResultSkeleton } from '@/components/shared/Skeleton';
import { ErrorCard } from '@/components/shared/PageHeader';

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useReview(id);

  if (isLoading) {
    return (
      <div className="px-6 py-6 lg:px-8 max-w-[1400px] mx-auto">
        <ReviewResultSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <ErrorCard message={error.message} onRetry={() => refetch()} />
      </div>
    );
  }

  if (!data) return null;

  return <ReviewView layout="tabs" data={data} refetch={() => void refetch()} />;
}
