import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PreferencesScope,
  type PreferenceColumn,
  useTablePreferences,
} from './TablePreferences';

const COLUMNS: PreferenceColumn[] = [
  { id: 'name', label: 'Name', alwaysVisible: true },
  { id: 'description', label: 'Description' },
];

function Probe() {
  const { preferences } = useTablePreferences('zones', COLUMNS);
  return (
    <p>
      {preferences.pageSize}:{preferences.visibleContent?.join(',')}
    </p>
  );
}

beforeEach(() => window.localStorage.clear());

describe('table preferences', () => {
  it('loads preferences from the current account only', async () => {
    window.localStorage.setItem(
      'route53:111111111111:table:zones',
      JSON.stringify({ pageSize: 20, visibleContent: ['name'] }),
    );

    const view = render(
      <PreferencesScope accountId="111111111111">
        <Probe />
      </PreferencesScope>,
    );
    expect(await screen.findByText('20:name')).toBeInTheDocument();

    view.unmount();
    render(
      <PreferencesScope accountId="222222222222">
        <Probe />
      </PreferencesScope>,
    );
    expect(await screen.findByText('10:name,description')).toBeInTheDocument();
  });

  it('ignores unsupported saved values', async () => {
    window.localStorage.setItem(
      'route53:111111111111:table:zones',
      JSON.stringify({ pageSize: 999, visibleContent: ['removed'] }),
    );

    render(
      <PreferencesScope accountId="111111111111">
        <Probe />
      </PreferencesScope>,
    );
    expect(await screen.findByText('10:name,description')).toBeInTheDocument();
  });
});
