import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { HealthCard } from '@/features/health/HealthCard';

export default function HomePage() {
  return (
    <ContentLayout
      header={
        <Header variant="h1" description="Manage hosted zones and DNS records.">
          Route 53
        </Header>
      }
    >
      <SpaceBetween size="l">
        <HealthCard />
      </SpaceBetween>
    </ContentLayout>
  );
}
