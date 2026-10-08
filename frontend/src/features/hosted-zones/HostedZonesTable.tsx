'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Pagination from '@cloudscape-design/components/pagination';
import PropertyFilter, {
  type PropertyFilterProps,
} from '@cloudscape-design/components/property-filter';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ROUTES } from '@/features/shell/navigation';
import { useHelpPanel } from '@/features/shell/help';
import {
  type PreferenceColumn,
  useTablePreferences,
} from '@/features/shell/TablePreferences';
import type { HostedZone, HostedZoneSort } from '@/lib/api/types';
import { useHostedZones } from './api';
import { BulkDeleteHostedZonesModal } from './BulkDeleteHostedZonesModal';
import { displayZoneName, displayZoneType } from './format';
import { DeleteHostedZoneModal, EditHostedZoneModal } from './HostedZoneModals';

type Navigate = (href: string) => void;
const EMPTY_QUERY: PropertyFilterProps.Query = { operation: 'and', tokens: [] };

const PREFERENCE_COLUMNS: PreferenceColumn[] = [
  { id: 'name', label: 'Hosted zone name', alwaysVisible: true },
  { id: 'type', label: 'Type' },
  { id: 'createdBy', label: 'Created by' },
  { id: 'recordCount', label: 'Record count' },
  { id: 'description', label: 'Description' },
  { id: 'tags', label: 'Tags' },
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
  {
    id: 'tags',
    header: 'Tags',
    cell: (zone) =>
      (zone.tags?.length ?? 0) > 0
        ? zone.tags?.map((tag) => `${tag.key}=${tag.value}`).join(', ')
        : '-',
  },
  { id: 'id', header: 'Hosted zone ID', cell: (zone) => zone.id },
];

const FILTER_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  {
    key: 'tagKey',
    propertyLabel: 'Tag key',
    groupValuesLabel: 'Tag keys',
    operators: ['='],
  },
  {
    key: 'tagValue',
    propertyLabel: 'Tag value',
    groupValuesLabel: 'Tag values',
    operators: ['='],
  },
];

const FILTER_I18N: PropertyFilterProps.I18nStrings = {
  filteringAriaLabel: 'Find hosted zones',
  dismissAriaLabel: 'Dismiss',
  filteringPlaceholder: 'Find hosted zones or filter by tag',
  groupValuesText: 'Values',
  groupPropertiesText: 'Properties',
  operatorsText: 'Operators',
  operationAndText: 'and',
  operationOrText: 'or',
  operatorEqualsText: 'equals',
  operatorContainsText: 'contains',
  editTokenHeader: 'Edit filter',
  propertyText: 'Property',
  operatorText: 'Operator',
  valueText: 'Value',
  cancelActionText: 'Cancel',
  applyActionText: 'Apply',
  allPropertiesLabel: 'All properties',
  tokenLimitShowMore: 'Show more',
  tokenLimitShowFewer: 'Show fewer',
  clearFiltersText: 'Clear filters',
  removeTokenButtonAriaLabel: (token) => `Remove ${token.propertyKey ?? 'text'} filter`,
  enteredTextLabel: (text) => `Use: ${text}`,
};

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
  const [query, setQuery] = useState<PropertyFilterProps.Query>(EMPTY_QUERY);
  const [sort, setSort] = useState<HostedZoneSort>('name');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<HostedZone[]>([]);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const params = useMemo(() => {
    const freeText = query.tokens.find((token) => token.propertyKey === undefined)?.value;
    const tagKey = query.tokens.find((token) => token.propertyKey === 'tagKey')?.value;
    const tagValue = query.tokens.find(
      (token) => token.propertyKey === 'tagValue',
    )?.value;
    return {
      q: typeof freeText === 'string' ? freeText : undefined,
      tag_key: typeof tagKey === 'string' ? tagKey : undefined,
      tag_value: typeof tagValue === 'string' ? tagValue : undefined,
      sort,
      page,
      page_size: pageSize,
    };
  }, [page, pageSize, query.tokens, sort]);
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
  const hasFilters = query.tokens.length > 0;
  const selectedZone = selected.length === 1 ? selected[0] : undefined;

  const clearFilter = () => {
    setQuery(EMPTY_QUERY);
    setPage(1);
  };

  return (
    <>
      <Table
        variant="full-page"
        trackBy="id"
        selectionType="multi"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        ariaLabels={{
          tableLabel: 'Hosted zones',
          selectionGroupLabel: 'Hosted zone selection',
          allItemsSelectionLabel: ({ selectedItems }) =>
            selectedItems.length === (data?.items.length ?? 0)
              ? 'Deselect all hosted zones'
              : 'Select all hosted zones',
          itemSelectionLabel: ({ selectedItems }, item) =>
            `${
              selectedItems.some((selectedItem) => selectedItem.id === item.id)
                ? 'Deselect'
                : 'Select'
            } ${displayZoneName(item.name)}`,
        }}
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
          <PropertyFilter
            query={query}
            i18nStrings={FILTER_I18N}
            filteringProperties={FILTER_PROPERTIES}
            filteringOptions={[]}
            countText={data ? `${data.total} match${data.total === 1 ? '' : 'es'}` : ''}
            onChange={({ detail }) => {
              setQuery(detail);
              setPage(1);
            }}
          />
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={pagesCount}
            ariaLabels={{
              paginationLabel: 'Hosted zones pages',
              previousPageLabel: 'Previous page',
              nextPageLabel: 'Next page',
              pageLabel: (pageNumber) => `Page ${pageNumber}`,
            }}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        empty={
          error ? (
            <ErrorState message={error.message} onRetry={() => void refetch()} />
          ) : hasFilters ? (
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
                  disabled={!selectedZone}
                  onClick={() =>
                    selectedZone && router.push(ROUTES.hostedZone(selectedZone.id))
                  }
                >
                  View details
                </Button>
                <Button disabled={!selectedZone} onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  disabled={selected.length === 0}
                  onClick={() => setDeleting(true)}
                >
                  Delete{selected.length > 1 ? ` (${selected.length})` : ''}
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
      {selectedZone && editing && (
        <EditHostedZoneModal zone={selectedZone} onDismiss={() => setEditing(false)} />
      )}
      {selectedZone && selected.length === 1 && deleting && (
        <DeleteHostedZoneModal
          zone={selectedZone}
          onDismiss={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            setSelected([]);
            if ((data?.items.length ?? 0) === 1 && page > 1) setPage(page - 1);
          }}
        />
      )}
      {selected.length > 1 && deleting && (
        <BulkDeleteHostedZonesModal
          zones={selected}
          onDismiss={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            setSelected([]);
            if ((data?.items.length ?? 0) === selected.length && page > 1) {
              setPage(page - 1);
            }
          }}
        />
      )}
    </>
  );
}
