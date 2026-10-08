import type { Metadata } from 'next';
import { HostedZoneDetails } from '@/features/hosted-zones/HostedZoneDetails';

export const metadata: Metadata = { title: 'Hosted zone details | Route 53' };

export default async function HostedZonePage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  return <HostedZoneDetails zoneId={decodeURIComponent(zoneId)} />;
}
