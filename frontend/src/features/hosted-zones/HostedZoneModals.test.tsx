import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlashMessages, FlashProvider } from '@/features/shell/flash';
import type { HostedZone, HostedZoneDetail } from '@/lib/api/types';
import { DeleteHostedZoneModal, EditHostedZoneModal } from './HostedZoneModals';

vi.mock('next/navigation', () => ({
  usePathname: () => '/route53/hosted-zones',
}));

const ZONE: HostedZone = {
  id: 'Z0812345ABCDEFGHIJKLM',
  name: 'example.com.',
  comment: 'Old description',
  private_zone: false,
  record_count: 2,
  created_at: '2026-10-01T12:00:00Z',
};

const UPDATED: HostedZoneDetail = {
  ...ZONE,
  comment: 'New description',
  updated_at: '2026-10-08T12:00:00Z',
  name_servers: ['ns-1.awsdns-00.com.'],
  vpc: null,
};

function jsonResponse(status: number, body?: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function renderModal(child: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FlashProvider>
        <FlashMessages />
        {child}
      </FlashProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hosted zone management modals', () => {
  it('updates only the description and confirms the change', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, UPDATED));
    vi.stubGlobal('fetch', fetchMock);
    const onDismiss = vi.fn();
    renderModal(<EditHostedZoneModal zone={ZONE} onDismiss={onDismiss} />);

    const description = screen.getByRole('textbox', { name: /Description/ });
    await userEvent.clear(description);
    await userEvent.type(description, 'New description');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('example.com was successfully updated.'),
    ).toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/hosted-zones/Z0812345ABCDEFGHIJKLM',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ comment: 'New description', tags: [] }),
      }),
    );
  });

  it('checks the description length before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderModal(<EditHostedZoneModal zone={ZONE} onDismiss={vi.fn()} />);

    const description = screen.getByRole('textbox', { name: /Description/ });
    await userEvent.clear(description);
    await userEvent.type(description, 'x'.repeat(257));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      screen.getByText('The description cannot exceed 256 characters.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes an empty zone after confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(204));
    vi.stubGlobal('fetch', fetchMock);
    const onDeleted = vi.fn();
    renderModal(
      <DeleteHostedZoneModal zone={ZONE} onDismiss={vi.fn()} onDeleted={onDeleted} />,
    );

    expect(
      screen.getByText('Deleting a hosted zone cannot be undone.', { exact: false }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(screen.getByText('example.com was successfully deleted.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/hosted-zones/Z0812345ABCDEFGHIJKLM',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('explains why a zone with other records cannot be deleted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, {
          error: {
            code: 'HostedZoneNotEmpty',
            message:
              'This hosted zone still has 2 record sets besides the default NS and SOA records. Delete them first.',
            details: { record_count: 2 },
          },
        }),
      ),
    );
    renderModal(
      <DeleteHostedZoneModal
        zone={{ ...ZONE, record_count: 4 }}
        onDismiss={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      await screen.findByText(
        'This hosted zone still has 2 record sets besides the default NS and SOA records. Delete them first.',
      ),
    ).toBeInTheDocument();
  });
});
