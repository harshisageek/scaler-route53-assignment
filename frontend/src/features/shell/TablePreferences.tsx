'use client';

import CollectionPreferences, {
  type CollectionPreferencesProps,
} from '@cloudscape-design/components/collection-preferences';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Preferences = CollectionPreferencesProps.Preferences;

const AccountContext = createContext('anonymous');

export function PreferencesScope({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  return <AccountContext.Provider value={accountId}>{children}</AccountContext.Provider>;
}

export interface PreferenceColumn {
  id: string;
  label: string;
  alwaysVisible?: boolean;
}

const PAGE_SIZES = [10, 20, 50];

export function useTablePreferences(tableId: string, columns: PreferenceColumn[]) {
  const accountId = useContext(AccountContext);
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);
  const defaults = useMemo<Preferences>(
    () => ({
      pageSize: PAGE_SIZES[0],
      visibleContent: columnIds,
      wrapLines: false,
      stripedRows: false,
      contentDensity: 'comfortable',
    }),
    [columnIds],
  );
  const storageKey = `route53:${accountId}:table:${tableId}`;
  const [preferences, setPreferencesState] = useState<Preferences>(() =>
    readPreferences(storageKey, defaults, columnIds),
  );

  const setPreferences = useCallback(
    (next: Preferences) => {
      setPreferencesState(next);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    },
    [storageKey],
  );

  const control = (
    <CollectionPreferences
      title="Preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={preferences}
      onConfirm={({ detail }) => setPreferences(detail)}
      pageSizePreference={{
        title: 'Page size',
        options: PAGE_SIZES.map((value) => ({
          value,
          label: `${value} resources`,
        })),
      }}
      wrapLinesPreference={{
        label: 'Wrap lines',
        description: 'Wrap long values onto multiple lines.',
      }}
      stripedRowsPreference={{
        label: 'Striped rows',
        description: 'Add alternating shading to table rows.',
      }}
      contentDensityPreference={{
        label: 'Compact mode',
        description: 'Fit more rows on the screen.',
      }}
      visibleContentPreference={{
        title: 'Visible columns',
        options: [
          {
            label: 'Table columns',
            options: columns.map((column) => ({
              id: column.id,
              label: column.label,
              editable: !column.alwaysVisible,
            })),
          },
        ],
      }}
    />
  );

  return { preferences, control };
}

function readPreferences(
  storageKey: string,
  defaults: Preferences,
  columnIds: string[],
): Preferences {
  if (typeof window === 'undefined') return defaults;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored) as Preferences;
    const visible = parsed.visibleContent?.filter((id) => columnIds.includes(id));
    return {
      ...defaults,
      ...parsed,
      pageSize: PAGE_SIZES.includes(parsed.pageSize ?? 0)
        ? parsed.pageSize
        : defaults.pageSize,
      visibleContent: visible?.length ? visible : defaults.visibleContent,
    };
  } catch {
    return defaults;
  }
}
