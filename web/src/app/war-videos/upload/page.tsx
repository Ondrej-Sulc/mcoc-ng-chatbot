import { Suspense } from 'react';
import UploadPageClient from './UploadPageClient';

function Loading() {
  return <p className="text-center text-muted-foreground">Loading form...</p>;
}

export default function UploadWarVideoPage() {
  return (
    <Suspense fallback={<Loading />}>
      <UploadPageClient />
    </Suspense>
  );
}
