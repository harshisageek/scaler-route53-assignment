'use client';

import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useHelpPanel } from './help';

export function ComingSoonPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const openHelp = useHelpPanel();

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description={description}
          info={
            <Link variant="info" onFollow={openHelp}>
              Info
            </Link>
          }
        >
          {title}
        </Header>
      }
    >
      <Container>
        <Box textAlign="center" padding={{ vertical: 'xxxl' }}>
          <SpaceBetween size="m">
            <StatusIndicator type="pending">Coming soon</StatusIndicator>
            <Box variant="p">
              This learning clone includes the console destination now. Its full workflow
              will be added in a later phase.
            </Box>
          </SpaceBetween>
        </Box>
      </Container>
    </ContentLayout>
  );
}
