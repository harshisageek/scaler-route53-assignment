import type { Metadata } from 'next';
import { CreateHostedZoneForm } from '@/features/hosted-zones/CreateHostedZoneForm';

export const metadata: Metadata = { title: 'Create hosted zone | Route 53' };

export default function CreateHostedZonePage() {
  return <CreateHostedZoneForm />;
}
