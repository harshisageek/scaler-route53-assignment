'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/features/shell/navigation';
import type { HostedZone } from '@/lib/api/types';
import { useHostedZones } from './api';
import { displayZoneName, displayZoneType } from './format';

type Navigate = (href: string) => void;

const columns = (navigate: Navigate): TableProps.ColumnDefinition<HostedZone>[] => [
  {
    id: 'name',
    header: 'Hosted zone name',
    cell: (zone) => (
      <Link
        href={ROUTES.hostedZone(zone.id)}
        onFollow={(event) => {
          event.preventDefault();
          navigate(ROUTES.hostedZone(zone.id));
        }}
      >
        {displayZoneName(zone.name)}
      </Link>
    ),
    isRowHeader: true,
  },
  { id: 'type', header: 'Type', cell: (zone) => displayZoneType(zone.private_zone) },
  { id: 'createdBy', header: 'Created by', cell: () => 'Route 53' },
  { id: 'recordCount', header: 'Record count', cell: (zone) => zone.record_count },
  { id: 'description', header: 'Description', cell: (zone) => zone.comment || '-' },
  { id: 'id', header: 'Hosted zone ID', cell: (zone) => zone.id },
];

function EmptyState() {
  return (
    <Box textAlign="center" color="inherit">
      <b>No hosted zones</b>
      <Box variant="p" color="inherit">
        You don&apos;t have any hosted zones.
      </Box>
    </Box>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Box textAlign="center" color="inherit">
      <SpaceBetween size="s">
        <StatusIndicator type="error">{message}</StatusIndicator>
        <Button onClick={onRetry}>Retry</Button>
      </SpaceBetween>
    </Box>
  );
}

export function HostedZonesTable() {
  const router = useRouter();
  const { data, isPending, error, refetch } = useHostedZones();

  return (
    <Table
      variant="full-page"
      trackBy="id"
      columnDefinitions={columns(router.push)}
      items={data?.items ?? []}
      loading={isPending}
      loadingText="Loading hosted zones"
      empty={
        error ? (
          <ErrorState message={error.message} onRetry={() => void refetch()} />
        ) : (
          <EmptyState />
        )
      }
      header={
        <Header
          variant="awsui-h1-sticky"
          counter={data ? `(${data.total})` : undefined}
          actions={
            <Button
              variant="primary"
              href={ROUTES.createHostedZone}
              onFollow={(event) => {
                event.preventDefault();
                router.push(ROUTES.createHostedZone);
              }}
            >
              Create hosted zone
            </Button>
          }
        >
          Hosted zones
        </Header>
      }
    />
  );
}
