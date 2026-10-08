import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlashMessages, FlashProvider } from '@/features/shell/flash';
import type { RecordSet } from '@/lib/api/types';
import { RecordSetModal } from './RecordSetModal';

vi.mock('next/navigation', () => ({
  usePathname: () => '/route53/hosted-zones/Z1',
}));

const RECORD: RecordSet = {
  id: 3,
  name: 'www.example.com.',
  type: 'A',
  ttl: 300,
  values: ['192.0.2.1'],
  created_at: '2026-10-08T12:00:00Z',
  updated_at: '2026-10-08T12:00:00Z',
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
  vi.clearAllMocks();
});

describe('RecordSetModal', () => {
  it('creates a record with one value per line', async () => {
    const saved = { ...RECORD, values: ['192.0.2.1', '192.0.2.2'] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, saved));
    vi.stubGlobal('fetch', fetchMock);
    const onDismiss = vi.fn();
    renderModal(
      <RecordSetModal zoneId="Z1" zoneName="example.com" onDismiss={onDismiss} />,
    );

    await userEvent.type(screen.getByLabelText('Record name'), 'www');
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Value' }),
      '192.0.2.1\n192.0.2.2',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create record' }));

    expect(
      await screen.findByText('www.example.com. was successfully created.'),
    ).toBeInTheDocument();
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/hosted-zones/Z1/records',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'www',
          type: 'A',
          ttl: 300,
          values: ['192.0.2.1', '192.0.2.2'],
        }),
      }),
    );
  });

  it('edits the TTL and values without changing the name or type', async () => {
    const saved = { ...RECORD, ttl: 60, values: ['192.0.2.9'] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, saved));
    vi.stubGlobal('fetch', fetchMock);
    renderModal(
      <RecordSetModal
        zoneId="Z1"
        zoneName="example.com"
        record={RECORD}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Record name')).toBeDisabled();
    const value = screen.getByRole('textbox', { name: 'Value' });
    await userEvent.clear(value);
    await userEvent.type(value, '192.0.2.9');
    const ttl = screen.getByLabelText('TTL (seconds)');
    await userEvent.clear(ttl);
    await userEvent.type(ttl, '60');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/hosted-zones/Z1/records/3',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            name: 'www.example.com.',
            type: 'A',
            ttl: 60,
            values: ['192.0.2.9'],
          }),
        }),
      ),
    );
  });

  it('checks TTL and values before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderModal(
      <RecordSetModal zoneId="Z1" zoneName="example.com" onDismiss={vi.fn()} />,
    );

    const ttl = screen.getByLabelText('TTL (seconds)');
    await userEvent.clear(ttl);
    await userEvent.type(ttl, '-1');
    await userEvent.click(screen.getByRole('button', { name: 'Create record' }));

    expect(
      screen.getByText('Enter a whole number from 0 to 2147483647.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter at least one value.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a duplicate-record conflict without closing the form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, {
          error: {
            code: 'RecordSetAlreadyExists',
            message: 'An A record set already exists for www.example.com.',
          },
        }),
      ),
    );
    renderModal(
      <RecordSetModal zoneId="Z1" zoneName="example.com" onDismiss={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText('Record name'), 'www');
    await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), '192.0.2.1');
    await userEvent.click(screen.getByRole('button', { name: 'Create record' }));

    expect(
      await screen.findByText('An A record set already exists for www.example.com.'),
    ).toBeInTheDocument();
  });
});
