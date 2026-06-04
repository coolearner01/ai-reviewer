'use client';

import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { ReviewSubmitForm } from '@/components/review/ReviewSubmitForm';
import { useSearchParams } from 'next/navigation';

function NewReviewForm() {
  const params = useSearchParams();
  const defaultUrl = params.get('url') ?? undefined;
  return <ReviewSubmitForm defaultPrUrl={defaultUrl} />;
}

export default function NewReviewPage() {
  return (
    <div className="px-6 py-6 lg:px-8 max-w-7xl mx-auto">
      <PageHeader
        title="Submit PR for Review"
        description="Pick an organization, choose a repo, and paste a PR number or URL"
      />
      <Suspense fallback={null}>
        <NewReviewForm />
      </Suspense>
    </div>
  );
}
