import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { ROUTES } from '@/features/shell/navigation';

export default function NotFoundPage() {
  return (
    <Box padding="xxl">
      <Container header={<Header variant="h1">Page not found</Header>}>
        <Box textAlign="center" padding={{ vertical: 'xxl' }}>
          <SpaceBetween size="m">
            <StatusIndicator type="warning">
              The page you requested does not exist.
            </StatusIndicator>
            <Button variant="primary" href={ROUTES.home}>
              Open Route 53
            </Button>
          </SpaceBetween>
        </Box>
      </Container>
    </Box>
  );
}
