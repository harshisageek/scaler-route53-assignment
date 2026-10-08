'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ContentLayout from '@cloudscape-design/components/content-layout';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROUTES } from '@/features/shell/navigation';
import { ApiError } from '@/lib/api/errors';
import type { HostedZoneDetail } from '@/lib/api/types';
import { useHostedZone } from './api';
import { displayTimestamp, displayZoneName, displayZoneType } from './format';
import { DeleteHostedZoneModal, EditHostedZoneModal } from './HostedZoneModals';
import { AWS_REGIONS } from './regions';

export function HostedZoneDetails({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: zone, error, isPending, refetch } = useHostedZone(zoneId);

  if (isPending) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <Box textAlign="center" padding="xxl">
        <SpaceBetween size="m" alignItems="center">
          <StatusIndicator type="error">
            {missing ? `No hosted zone found with ID ${zoneId}.` : error.message}
          </StatusIndicator>
          {missing ? (
            <Button onClick={() => router.push(ROUTES.hostedZones)}>
              Back to hosted zones
            </Button>
          ) : (
            <Button onClick={() => void refetch()}>Retry</Button>
          )}
        </SpaceBetween>
      </Box>
    );
  }

  return (
    <>
      <ContentLayout
        header={
          <Header
            variant="h1"
            description={zone.comment ?? undefined}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setEditing(true)}>Edit</Button>
                <Button onClick={() => setDeleting(true)}>Delete</Button>
              </SpaceBetween>
            }
          >
            {displayZoneName(zone.name)}
          </Header>
        }
      >
        <ExpandableSection
          variant="container"
          defaultExpanded
          headerText="Hosted zone details"
        >
          <KeyValuePairs columns={3} items={detailItems(zone)} />
        </ExpandableSection>
      </ContentLayout>
      {editing && <EditHostedZoneModal zone={zone} onDismiss={() => setEditing(false)} />}
      {deleting && (
        <DeleteHostedZoneModal
          zone={zone}
          successPath={ROUTES.hostedZones}
          onDismiss={() => setDeleting(false)}
          onDeleted={() => router.push(ROUTES.hostedZones)}
        />
      )}
    </>
  );
}

function detailItems(zone: HostedZoneDetail) {
  const items = [
    { label: 'Hosted zone name', value: displayZoneName(zone.name) },
    { label: 'Hosted zone ID', value: zone.id },
    { label: 'Description', value: zone.comment ?? '-' },
    { label: 'Type', value: `${displayZoneType(zone.private_zone)} hosted zone` },
    { label: 'Record count', value: zone.record_count },
    { label: 'Created', value: displayTimestamp(zone.created_at) },
    {
      label: 'Name servers',
      value: (
        <ul className="plain-list">
          {zone.name_servers.map((server) => (
            <li key={server}>{server}</li>
          ))}
        </ul>
      ),
    },
  ];
  if (zone.vpc) {
    const region = AWS_REGIONS.find((r) => r.code === zone.vpc?.region);
    items.push({
      label: 'VPC',
      value: `${zone.vpc.vpc_id} (${region ? `${region.name}, ` : ''}${zone.vpc.region})`,
    });
  }
  return items;
}
