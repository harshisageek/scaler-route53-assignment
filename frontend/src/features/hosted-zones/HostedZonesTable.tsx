'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Pagination from '@cloudscape-design/components/pagination';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import TextFilter from '@cloudscape-design/components/text-filter';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '@/features/shell/navigation';
import { useHelpPanel } from '@/features/shell/help';
import {
  type PreferenceColumn,
  useTablePreferences,
} from '@/features/shell/TablePreferences';
import type { HostedZone, HostedZoneSort } from '@/lib/api/types';
import { useHostedZones } from './api';
import { displayZoneName, displayZoneType } from './format';
import { DeleteHostedZoneModal, EditHostedZoneModal } from './HostedZoneModals';

type Navigate = (href: string) => void;

const PREFERENCE_COLUMNS: PreferenceColumn[] = [
  { id: 'name', label: 'Hosted zone name', alwaysVisible: true },
  { id: 'type', label: 'Type' },
  { id: 'createdBy', label: 'Created by' },
  { id: 'recordCount', label: 'Record count' },
  { id: 'description', label: 'Description' },
  { id: 'id', label: 'Hosted zone ID' },
];

const columns = (navigate: Navigate): TableProps.ColumnDefinition<HostedZone>[] => [
  {
    id: 'name',
    sortingField: 'name',
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
  {
    id: 'type',
    sortingField: 'type',
    header: 'Type',
    cell: (zone) => displayZoneType(zone.private_zone),
  },
  { id: 'createdBy', header: 'Created by', cell: () => 'Route 53' },
  {
    id: 'recordCount',
    sortingField: 'record_count',
    header: 'Record count',
    cell: (zone) => zone.record_count,
  },
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

function NoMatches({ clear }: { clear: () => void }) {
  return (
    <Box textAlign="center" color="inherit">
      <SpaceBetween size="s">
        <b>No matches</b>
        <Box variant="p" color="inherit">
          We couldn&apos;t find any hosted zones matching your search.
        </Box>
        <Button onClick={clear}>Clear filter</Button>
      </SpaceBetween>
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
  const openHelp = useHelpPanel();
  const { preferences, control: preferencesControl } = useTablePreferences(
    'hosted-zones',
    PREFERENCE_COLUMNS,
  );
  const pageSize = preferences.pageSize ?? 10;
  const [filteringText, setFilteringText] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<HostedZoneSort>('name');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<HostedZone>();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const params = useMemo(
    () => ({ q: query || undefined, sort, page, page_size: pageSize }),
    [page, pageSize, query, sort],
  );
  const { data, isPending, error, refetch } = useHostedZones(params);
  const columnDefinitions = useMemo(() => columns(router.push), [router]);
  const visibleColumns =
    preferences.visibleContent ?? PREFERENCE_COLUMNS.map(({ id }) => id);
  const displayedColumns = columnDefinitions.filter(
    (column) => column.id && visibleColumns.includes(column.id),
  );
  const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
  const sortingColumn = columnDefinitions.find(
    (column) => column.sortingField === sortField,
  );
  const pagesCount = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuery(filteringText.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [filteringText]);

  const clearFilter = () => {
    setFilteringText('');
    setQuery('');
    setPage(1);
  };

  return (
    <>
      <Table
        variant="full-page"
        trackBy="id"
        selectionType="single"
        selectedItems={selected ? [selected] : []}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems[0])}
        columnDefinitions={displayedColumns}
        items={data?.items ?? []}
        loading={isPending}
        loadingText="Loading hosted zones"
        skeleton={{ totalRows: pageSize }}
        wrapLines={preferences.wrapLines}
        stripedRows={preferences.stripedRows}
        contentDensity={preferences.contentDensity}
        preferences={preferencesControl}
        sortingColumn={sortingColumn}
        sortingDescending={sort.startsWith('-')}
        onSortingChange={({ detail }) => {
          const field = detail.sortingColumn.sortingField;
          if (!field) return;
          setSort(`${detail.isDescending ? '-' : ''}${field}` as HostedZoneSort);
          setPage(1);
        }}
        filter={
          <TextFilter
            filteringText={filteringText}
            filteringPlaceholder="Find hosted zones"
            filteringAriaLabel="Find hosted zones"
            countText={data ? `${data.total} match${data.total === 1 ? '' : 'es'}` : ''}
            onChange={({ detail }) => setFilteringText(detail.filteringText)}
          />
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={pagesCount}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        empty={
          error ? (
            <ErrorState message={error.message} onRetry={() => void refetch()} />
          ) : query ? (
            <NoMatches clear={clearFilter} />
          ) : (
            <EmptyState />
          )
        }
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={data ? `(${data.total})` : undefined}
            info={
              <Link variant="info" onFollow={openHelp}>
                Info
              </Link>
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={!selected}
                  onClick={() => selected && router.push(ROUTES.hostedZone(selected.id))}
                >
                  View details
                </Button>
                <Button disabled={!selected} onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button disabled={!selected} onClick={() => setDeleting(true)}>
                  Delete
                </Button>
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
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
      />
      {selected && editing && (
        <EditHostedZoneModal zone={selected} onDismiss={() => setEditing(false)} />
      )}
      {selected && deleting && (
        <DeleteHostedZoneModal
          zone={selected}
          onDismiss={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            setSelected(undefined);
            if ((data?.items.length ?? 0) === 1 && page > 1) setPage(page - 1);
          }}
        />
      )}
    </>
  );
}
