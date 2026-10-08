import type { Metadata } from 'next';
import { ComingSoonPage } from '@/features/shell/ComingSoonPage';

export const metadata: Metadata = { title: 'Health checks | Route 53' };

export default function HealthChecksPage() {
  return (
    <ComingSoonPage
      title="Health checks"
      description="Monitor endpoints and use their health when routing DNS traffic."
    />
  );
}
