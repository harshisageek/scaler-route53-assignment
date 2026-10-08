import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlashMessages, FlashProvider } from '@/features/shell/flash';
import type { HostedZoneList } from '@/lib/api/types';
import { HostedZonesTable } from './HostedZonesTable';

const router = { push: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/route53/hosted-zones',
}));

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FlashProvider>
        <FlashMessages />
        <HostedZonesTable />
      </FlashProvider>
    </QueryClientProvider>,
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

const ONE_ZONE: HostedZoneList = {
  total: 1,
  page: 1,
  page_size: 10,
  items: [
    {
      id: 'Z0812345ABCDEFGHIJKLM',
      name: 'example.com.',
      comment: 'Production zone',
      private_zone: false,
      record_count: 7,
      created_at: '2026-10-01T12:00:00Z',
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('HostedZonesTable', () => {
  it('lists zones the way the console shows them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, ONE_ZONE)));

    renderTable();

    expect(await screen.findByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('Production zone')).toBeInTheDocument();
    expect(screen.getByText('Z0812345ABCDEFGHIJKLM')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('searches on the server and explains when nothing matches', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, ONE_ZONE))
      .mockResolvedValueOnce(
        jsonResponse(200, { items: [], total: 0, page: 1, page_size: 10 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderTable();
    await screen.findByText('example.com');

    await userEvent.type(
      screen.getByRole('combobox', { name: 'Find hosted zones' }),
      'missing',
    );
    await userEvent.click(screen.getByText('Use: missing'));

    expect(await screen.findByText('No matches')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/hosted-zones?q=missing&sort=name&page=1&page_size=10',
      expect.anything(),
    );
  });

  it('filters on the server by tag key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, ONE_ZONE));
    vi.stubGlobal('fetch', fetchMock);
    renderTable();
    await screen.findByText('example.com');

    const filter = screen.getByRole('combobox', { name: 'Find hosted zones' });
    await userEvent.click(filter);
    await userEvent.click(screen.getByRole('option', { name: 'Tag key' }));
    await userEvent.type(filter, 'Owner');
    await userEvent.click(screen.getByText('Use: Tag key = Owner'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/v1/hosted-zones?tag_key=Owner&sort=name&page=1&page_size=10',
        expect.anything(),
      ),
    );
  });

  it('sends sorting and page changes to the server', async () => {
    const twoPages = { ...ONE_ZONE, total: 11 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, twoPages));
    vi.stubGlobal('fetch', fetchMock);
    renderTable();
    await screen.findByText('example.com');

    await userEvent.click(screen.getByRole('button', { name: /Hosted zone name/ }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/hosted-zones?sort=-name&page=1&page_size=10',
        expect.anything(),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/hosted-zones?sort=-name&page=2&page_size=10',
        expect.anything(),
      ),
    );
  });

  it('links each zone to its details and offers to create one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, ONE_ZONE)));

    renderTable();

    await userEvent.click(await screen.findByRole('link', { name: 'example.com' }));
    expect(router.push).toHaveBeenCalledWith(
      '/route53/hosted-zones/Z0812345ABCDEFGHIJKLM',
    );
    await userEvent.click(screen.getByRole('link', { name: 'Create hosted zone' }));
    expect(router.push).toHaveBeenCalledWith('/route53/hosted-zones/create');

    await userEvent.click(screen.getByRole('radio'));
    await userEvent.click(screen.getByRole('button', { name: 'View details' }));
    expect(router.push).toHaveBeenCalledWith(
      '/route53/hosted-zones/Z0812345ABCDEFGHIJKLM',
    );
  });

  it('explains an empty account instead of showing a blank table', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { items: [], total: 0, page: 1, page_size: 10 }),
        ),
    );

    renderTable();

    expect(await screen.findByText('No hosted zones')).toBeInTheDocument();
  });

  it('shows the API error and retries on request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(500, {
          error: { code: 'InternalError', message: 'Something broke.' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, ONE_ZONE));
    vi.stubGlobal('fetch', fetchMock);

    renderTable();

    expect(await screen.findByText('Something broke.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('example.com')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
