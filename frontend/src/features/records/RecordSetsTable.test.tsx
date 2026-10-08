import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlashMessages, FlashProvider } from '@/features/shell/flash';
import type { RecordSetList } from '@/lib/api/types';
import { RecordSetsTable } from './RecordSetsTable';

vi.mock('next/navigation', () => ({
  usePathname: () => '/route53/hosted-zones/Z1',
}));

const RECORDS: RecordSetList = {
  total: 2,
  page: 1,
  page_size: 10,
  items: [
    {
      id: 1,
      name: 'example.com.',
      type: 'NS',
      ttl: 172800,
      values: ['ns-1.awsdns-00.com.', 'ns-2.awsdns-00.net.'],
      routing_policy: 'simple',
      set_identifier: null,
      weight: null,
      failover_role: null,
      region: null,
      geolocation: null,
      created_at: '2026-10-08T12:00:00Z',
      updated_at: '2026-10-08T12:00:00Z',
    },
    {
      id: 3,
      name: 'www.example.com.',
      type: 'A',
      ttl: 300,
      values: ['192.0.2.1'],
      routing_policy: 'simple',
      set_identifier: null,
      weight: null,
      failover_role: null,
      region: null,
      geolocation: null,
      created_at: '2026-10-08T12:00:00Z',
      updated_at: '2026-10-08T12:00:00Z',
    },
  ],
};

function jsonResponse(status: number, body?: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FlashProvider>
        <FlashMessages />
        <RecordSetsTable zoneId="Z1" zoneName="example.com" />
      </FlashProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('RecordSetsTable', () => {
  it('shows record values and the Route 53 columns', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, RECORDS)));
    renderTable();

    expect(await screen.findByText('www.example.com.')).toBeInTheDocument();
    expect(screen.getByText('192.0.2.1')).toBeInTheDocument();
    expect(screen.getByText('TTL (seconds)')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('searches and sorts on the server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, RECORDS));
    vi.stubGlobal('fetch', fetchMock);
    renderTable();
    await screen.findByText('www.example.com.');

    const filter = screen.getByRole('combobox', { name: 'Filter records' });
    await userEvent.type(filter, 'www');
    await userEvent.click(screen.getByRole('option', { name: 'Use: www' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/hosted-zones/Z1/records?q=www&sort=name&page=1&page_size=10',
        expect.anything(),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'TTL (seconds)' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/hosted-zones/Z1/records?q=www&sort=ttl&page=1&page_size=10',
        expect.anything(),
      ),
    );
  });

  it('turns a Type property token into the server type filter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, RECORDS));
    vi.stubGlobal('fetch', fetchMock);
    renderTable();
    await screen.findByText('www.example.com.');

    const filter = screen.getByRole('combobox', { name: 'Filter records' });
    await userEvent.click(filter);
    await userEvent.click(screen.getByRole('option', { name: 'Type' }));
    await userEvent.click(screen.getByRole('option', { name: /Type =A$/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/hosted-zones/Z1/records?type=A&sort=name&page=1&page_size=10',
        expect.anything(),
      ),
    );
  });

  it('opens create and edit forms from the table actions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, RECORDS)));
    renderTable();
    await screen.findByText('www.example.com.');

    await userEvent.click(screen.getByRole('button', { name: 'Create record' }));
    expect(screen.getByRole('dialog', { name: 'Create record' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const wwwRow = screen.getByRole('row', { name: /www\.example\.com/ });
    await userEvent.click(within(wwwRow).getByRole('radio'));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('dialog', { name: 'Edit record' })).toBeInTheDocument();
  });

  it('does not offer to edit or delete the default NS record', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, RECORDS)));
    renderTable();
    await screen.findByText('www.example.com.');

    const nsRow = screen.getByRole('row', { name: /example\.com\..*NS/ });
    await userEvent.click(within(nsRow).getByRole('radio'));

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('deletes the selected record and confirms it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, RECORDS))
      .mockResolvedValueOnce(jsonResponse(204))
      .mockResolvedValue(
        jsonResponse(200, { ...RECORDS, total: 1, items: [RECORDS.items[0]] }),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderTable();
    await screen.findByText('www.example.com.');

    const wwwRow = screen.getByRole('row', { name: /www\.example\.com/ });
    await userEvent.click(within(wwwRow).getByRole('radio'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete record' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText('www.example.com. A was successfully deleted.'),
    ).toBeInTheDocument();
  });
});
