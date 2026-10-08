import type { Metadata } from 'next';
import { HostedZonesTable } from '@/features/hosted-zones/HostedZonesTable';

export const metadata: Metadata = { title: 'Hosted zones | Route 53' };

export default function HostedZonesPage() {
  return <HostedZonesTable />;
}
