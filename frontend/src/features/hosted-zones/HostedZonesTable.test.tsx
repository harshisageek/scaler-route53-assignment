import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostedZoneList } from '@/lib/api/types';
import { HostedZonesTable } from './HostedZonesTable';

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HostedZonesTable />
    </QueryClientProvider>,
  );
}

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

const ONE_ZONE: HostedZoneList = {
  total: 1,
  items: [
    {
      id: 'Z0812345ABCDEFGHIJKLM',
      name: 'example.com.',
      comment: 'Production zone',
      private_zone: false,
      created_at: '2026-10-01T12:00:00Z',
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HostedZonesTable', () => {
  it('lists zones the way the console shows them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, ONE_ZONE)));

    renderTable();

    expect(await screen.findByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('Production zone')).toBeInTheDocument();
    expect(screen.getByText('Z0812345ABCDEFGHIJKLM')).toBeInTheDocument();
    expect(screen.getByText('(1)')).toBeInTheDocument();
  });

  it('explains an empty account instead of showing a blank table', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { items: [], total: 0 })),
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
