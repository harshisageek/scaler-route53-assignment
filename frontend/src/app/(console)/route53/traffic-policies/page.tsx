import type { Metadata } from 'next';
import { ComingSoonPage } from '@/features/shell/ComingSoonPage';

export const metadata: Metadata = { title: 'Traffic policies | Route 53' };

export default function TrafficPoliciesPage() {
  return (
    <ComingSoonPage
      title="Traffic policies"
      description="Create reusable policies that route DNS traffic using visual rules."
    />
  );
}
