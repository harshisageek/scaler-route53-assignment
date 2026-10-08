'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ButtonDropdown from '@cloudscape-design/components/button-dropdown';
import ContentLayout from '@cloudscape-design/components/content-layout';
import ExpandableSection from '@cloudscape-design/components/expandable-section';
import Header from '@cloudscape-design/components/header';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Link from '@cloudscape-design/components/link';
import Skeleton from '@cloudscape-design/components/skeleton';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { RecordSetsTable } from '@/features/records/RecordSetsTable';
import { useFlash } from '@/features/shell/flash';
import { useHelpPanel } from '@/features/shell/help';
import { ROUTES } from '@/features/shell/navigation';
import { ApiError } from '@/lib/api/errors';
import type { HostedZoneDetail, HostedZoneTag } from '@/lib/api/types';
import { useHostedZone } from './api';
import { displayTimestamp, displayZoneName, displayZoneType } from './format';
import { downloadHostedZone, type ZoneExportFormat } from './export';
import { DeleteHostedZoneModal, EditHostedZoneModal } from './HostedZoneModals';
import { AWS_REGIONS } from './regions';

const TAG_COLUMNS: TableProps.ColumnDefinition<HostedZoneTag>[] = [
  { id: 'key', header: 'Key', cell: (tag) => tag.key, isRowHeader: true },
  { id: 'value', header: 'Value', cell: (tag) => tag.value || '-' },
];

export function HostedZoneDetails({ zoneId }: { zoneId: string }) {
  const router = useRouter();
  const openHelp = useHelpPanel();
  const notify = useFlash();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: zone, error, isPending, refetch } = useHostedZone(zoneId);

  const exportZone = async (format: ZoneExportFormat) => {
    try {
      await downloadHostedZone(zoneId, format);
      notify({
        type: 'success',
        content: `${format === 'bind' ? 'BIND' : 'JSON'} export downloaded.`,
      });
    } catch (exportError) {
      notify({
        type: 'error',
        content:
          exportError instanceof Error
            ? exportError.message
            : 'The hosted zone could not be exported.',
      });
    }
  };

  if (isPending) {
    return (
      <Box textAlign="center" padding="xxl">
        <SpaceBetween size="s">
          <Skeleton variant="text-heading-xl" />
          <Skeleton variant="text-body-m" />
          <Skeleton variant="text-body-m" />
        </SpaceBetween>
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
            info={
              <Link variant="info" onFollow={openHelp}>
                Info
              </Link>
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <ButtonDropdown
                  items={[
                    { id: 'bind', text: 'Download BIND file' },
                    { id: 'json', text: 'Download JSON file' },
                  ]}
                  onItemClick={({ detail }) =>
                    void exportZone(detail.id as ZoneExportFormat)
                  }
                >
                  Export
                </ButtonDropdown>
                <Button onClick={() => setEditing(true)}>Edit</Button>
                <Button onClick={() => setDeleting(true)}>Delete</Button>
              </SpaceBetween>
            }
          >
            {displayZoneName(zone.name)}
          </Header>
        }
      >
        <SpaceBetween size="l">
          <ExpandableSection
            variant="container"
            defaultExpanded
            headerText="Hosted zone details"
          >
            <KeyValuePairs columns={3} items={detailItems(zone)} />
          </ExpandableSection>
          <Table
            variant="container"
            trackBy="key"
            columnDefinitions={TAG_COLUMNS}
            items={zone.tags ?? []}
            empty={
              <Box textAlign="center">
                <b>No tags</b>
                <Box variant="p">This hosted zone has no tags.</Box>
              </Box>
            }
            header={<Header counter={`(${zone.tags?.length ?? 0})`}>Tags</Header>}
          />
          <RecordSetsTable zoneId={zone.id} zoneName={displayZoneName(zone.name)} />
        </SpaceBetween>
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
