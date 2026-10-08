import type { Metadata } from 'next';
import { ComingSoonPage } from '@/features/shell/ComingSoonPage';

export const metadata: Metadata = { title: 'Dashboard | Route 53' };

export default function DashboardPage() {
  return (
    <ComingSoonPage
      title="Route 53 dashboard"
      description="An overview of your DNS, health checks, and traffic routing resources."
    />
  );
}
