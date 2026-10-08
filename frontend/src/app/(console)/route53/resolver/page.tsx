import type { Metadata } from 'next';
import { ComingSoonPage } from '@/features/shell/ComingSoonPage';

export const metadata: Metadata = { title: 'Resolver | Route 53' };

export default function ResolverPage() {
  return (
    <ComingSoonPage
      title="Route 53 Resolver"
      description="Connect DNS queries between virtual private clouds and your network."
    />
  );
}
