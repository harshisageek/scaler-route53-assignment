import type { Metadata } from 'next';
import { ComingSoonPage } from '@/features/shell/ComingSoonPage';

export const metadata: Metadata = { title: 'Profiles | Route 53' };

export default function ProfilesPage() {
  return (
    <ComingSoonPage
      title="Route 53 Profiles"
      description="Share DNS-related configurations across virtual private clouds."
    />
  );
}
