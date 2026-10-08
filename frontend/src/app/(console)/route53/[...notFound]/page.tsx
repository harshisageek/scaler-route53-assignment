'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/features/shell/navigation';

export default function Route53NotFoundPage() {
  const router = useRouter();

  return (
    <ContentLayout header={<Header variant="h1">Page not found</Header>}>
      <Container>
        <Box textAlign="center" padding={{ vertical: 'xxl' }}>
          <SpaceBetween size="m">
            <StatusIndicator type="warning">
              The Route 53 page you requested does not exist.
            </StatusIndicator>
            <Button variant="primary" onClick={() => router.push(ROUTES.hostedZones)}>
              Go to hosted zones
            </Button>
          </SpaceBetween>
        </Box>
      </Container>
    </ContentLayout>
  );
}
