'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import PropertyFilter, {
  type PropertyFilterProps,
} from '@cloudscape-design/components/property-filter';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table, { type TableProps } from '@cloudscape-design/components/table';
import { useMemo, useState } from 'react';
import type { RecordSet, RecordSetSort, RecordType } from '@/lib/api/types';
import { useRecordSets } from './api';
import { DeleteRecordSetModal } from './DeleteRecordSetModal';
import { RecordSetModal } from './RecordSetModal';
import { RECORD_TYPES } from './recordTypes';

const PAGE_SIZE = 10;
const EMPTY_QUERY: PropertyFilterProps.Query = { operation: 'and', tokens: [] };

const COLUMNS: TableProps.ColumnDefinition<RecordSet>[] = [
  {
    id: 'name',
    header: 'Record name',
    cell: (record) => record.name,
    sortingField: 'name',
  },
  { id: 'type', header: 'Type', cell: (record) => record.type, sortingField: 'type' },
  {
    id: 'values',
    header: 'Value/Route traffic to',
    cell: (record) => (
      <ul className="plain-list">
        {record.values.map((value, index) => (
          <li key={`${index}-${value}`}>{value}</li>
        ))}
      </ul>
    ),
  },
  {
    id: 'ttl',
    header: 'TTL (seconds)',
    cell: (record) => record.ttl,
    sortingField: 'ttl',
  },
];

const FILTER_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  {
    key: 'type',
    propertyLabel: 'Type',
    groupValuesLabel: 'Record types',
    operators: ['='],
  },
];

const FILTER_OPTIONS: PropertyFilterProps.FilteringOption[] = RECORD_TYPES.map(
  (type) => ({
    propertyKey: 'type',
    value: type,
  }),
);

const FILTER_I18N: PropertyFilterProps.I18nStrings = {
  filteringAriaLabel: 'Filter records',
  dismissAriaLabel: 'Dismiss',
  filteringPlaceholder: 'Find records',
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

interface Props {
  zoneId: string;
  zoneName: string;
}

export function RecordSetsTable({ zoneId, zoneName }: Props) {
  const [query, setQuery] = useState<PropertyFilterProps.Query>(EMPTY_QUERY);
  const [sort, setSort] = useState<RecordSetSort>('name');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RecordSet>();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const params = useMemo(() => {
    const freeText = query.tokens.find((token) => token.propertyKey === undefined)?.value;
    const type = query.tokens.find((token) => token.propertyKey === 'type')?.value;
    return {
      q: typeof freeText === 'string' ? freeText : undefined,
      type: typeof type === 'string' ? (type as RecordType) : undefined,
      sort,
      page,
      page_size: PAGE_SIZE,
    };
  }, [page, query.tokens, sort]);
  const { data, error, isPending, refetch } = useRecordSets(zoneId, params);
  const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
  const sortingColumn = COLUMNS.find((column) => column.sortingField === sortField);
  const pagesCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const hasFilters = query.tokens.length > 0;

  return (
    <>
      <Table
        variant="container"
        trackBy="id"
        selectionType="single"
        selectedItems={selected ? [selected] : []}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems[0])}
        columnDefinitions={COLUMNS}
        items={data?.items ?? []}
        loading={isPending}
        loadingText="Loading records"
        sortingColumn={sortingColumn}
        sortingDescending={sort.startsWith('-')}
        onSortingChange={({ detail }) => {
          const field = detail.sortingColumn.sortingField;
          if (!field) return;
          setSort(`${detail.isDescending ? '-' : ''}${field}` as RecordSetSort);
          setPage(1);
        }}
        filter={
          <PropertyFilter
            query={query}
            i18nStrings={FILTER_I18N}
            filteringProperties={FILTER_PROPERTIES}
            filteringOptions={FILTER_OPTIONS}
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
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        empty={
          error ? (
            <Box textAlign="center">
              <SpaceBetween size="s">
                <StatusIndicator type="error">{error.message}</StatusIndicator>
                <Button onClick={() => void refetch()}>Retry</Button>
              </SpaceBetween>
            </Box>
          ) : (
            <Box textAlign="center">
              <SpaceBetween size="s">
                <b>{hasFilters ? 'No matches' : 'No records'}</b>
                <Box variant="p">
                  {hasFilters
                    ? "We couldn't find any records matching your filters."
                    : 'This hosted zone has no records.'}
                </Box>
                {hasFilters && (
                  <Button
                    onClick={() => {
                      setQuery(EMPTY_QUERY);
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </SpaceBetween>
            </Box>
          )
        }
        header={
          <Header
            counter={data ? `(${data.total})` : undefined}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={!selected || selected.type === 'SOA'}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
                <Button disabled={!selected} onClick={() => setDeleting(true)}>
                  Delete
                </Button>
                <Button variant="primary" onClick={() => setCreating(true)}>
                  Create record
                </Button>
              </SpaceBetween>
            }
          >
            Records
          </Header>
        }
      />
      {creating && (
        <RecordSetModal
          zoneId={zoneId}
          zoneName={zoneName}
          onDismiss={() => setCreating(false)}
        />
      )}
      {selected && editing && (
        <RecordSetModal
          zoneId={zoneId}
          zoneName={zoneName}
          record={selected}
          onDismiss={() => setEditing(false)}
        />
      )}
      {selected && deleting && (
        <DeleteRecordSetModal
          zoneId={zoneId}
          record={selected}
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
