'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useHealth } from './api';

/**
 * Proves the whole path end to end: browser, Next.js rewrite, FastAPI, SQLite.
 * Later phases replace this page, but the check stays reachable.
 */
export function HealthCard() {
  const { data, isPending, error } = useHealth();

  return (
    <Container header={<Header variant="h2">Backend connectivity</Header>}>
      {isPending && (
        <Box textAlign="center" padding="l">
          <Spinner size="normal" /> Checking the API…
        </Box>
      )}

      {error && (
        <Alert type="error" header="Could not reach the API">
          {error.message}
        </Alert>
      )}

      {data && (
        <KeyValuePairs
          columns={3}
          items={[
            {
              label: 'API',
              value: <StatusIndicator type="success">{data.status}</StatusIndicator>,
            },
            {
              label: 'Database',
              value: <StatusIndicator type="success">{data.database}</StatusIndicator>,
            },
            { label: 'Environment', value: data.environment },
          ]}
        />
      )}
    </Container>
  );
}
