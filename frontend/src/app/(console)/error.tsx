'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useEffect } from 'react';

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ContentLayout header={<Header variant="h1">Something went wrong</Header>}>
      <Container>
        <Box textAlign="center" padding={{ vertical: 'xxl' }}>
          <SpaceBetween size="m">
            <StatusIndicator type="error">
              The console could not load this page.
            </StatusIndicator>
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
          </SpaceBetween>
        </Box>
      </Container>
    </ContentLayout>
  );
}
