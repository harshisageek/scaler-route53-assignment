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
  routing_policy: 'simple',
  set_identifier: null,
  weight: null,
  failover_role: null,
  region: null,
  geolocation: null,
  alias: false,
  alias_target_type: null,
  alias_target: null,
  evaluate_target_health: false,
  created_at: '2026-10-08T12:00:00Z',
  updated_at: '2026-10-08T12:00:00Z',
};
const SIMPLE_ROUTING = {
  routing_policy: 'simple',
  set_identifier: null,
  weight: null,
  failover_role: null,
  region: null,
  geolocation: null,
} as const;
const NOT_AN_ALIAS = {
  alias: false,
  alias_target_type: null,
  alias_target: null,
  evaluate_target_health: false,
} as const;

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
          ...SIMPLE_ROUTING,
          ...NOT_AN_ALIAS,
        }),
      }),
    );
  });

  it('creates an apex alias to a mocked AWS target', async () => {
    const saved: RecordSet = {
      ...RECORD,
      name: 'example.com.',
      ttl: null,
      values: [],
      alias: true,
      alias_target_type: 'cloudfront',
      alias_target: 'd111111abcdef8.cloudfront.net.',
      evaluate_target_health: true,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, saved));
    vi.stubGlobal('fetch', fetchMock);
    renderModal(
      <RecordSetModal zoneId="Z1" zoneName="example.com" onDismiss={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'Alias' }));
    await userEvent.click(screen.getByRole('button', { name: /Choose an endpoint/ }));
    await userEvent.click(
      screen.getByRole('option', { name: /CloudFront distribution/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: /Choose a target/ }));
    await userEvent.click(
      screen.getByRole('option', {
        name: 'd111111abcdef8.cloudfront.net.',
      }),
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Evaluate target health' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create record' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/hosted-zones/Z1/records',
        expect.objectContaining({
          body: JSON.stringify({
            name: '',
            type: 'A',
            ttl: null,
            values: [],
            ...SIMPLE_ROUTING,
            alias: true,
            alias_target_type: 'cloudfront',
            alias_target: 'd111111abcdef8.cloudfront.net.',
            evaluate_target_health: true,
          }),
        }),
      ),
    );
  });

  it('collects the fields for a weighted routing policy', async () => {
    const saved: RecordSet = {
      ...RECORD,
      routing_policy: 'weighted',
      set_identifier: 'blue',
      weight: 25,
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, saved));
    vi.stubGlobal('fetch', fetchMock);
    renderModal(
      <RecordSetModal zoneId="Z1" zoneName="example.com" onDismiss={vi.fn()} />,
    );

    await userEvent.type(screen.getByLabelText('Record name'), 'www');
    await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), '192.0.2.1');
    await userEvent.click(screen.getByRole('button', { name: /Simple routing/ }));
    await userEvent.click(screen.getByRole('option', { name: /Weighted/ }));
    await userEvent.type(screen.getByLabelText('Set identifier'), 'blue');
    const weight = screen.getByLabelText('Weight');
    await userEvent.clear(weight);
    await userEvent.type(weight, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Create record' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/hosted-zones/Z1/records',
        expect.objectContaining({
          body: JSON.stringify({
            name: 'www',
            type: 'A',
            ttl: 300,
            values: ['192.0.2.1'],
            routing_policy: 'weighted',
            set_identifier: 'blue',
            weight: 25,
            failover_role: null,
            region: null,
            geolocation: null,
            ...NOT_AN_ALIAS,
          }),
        }),
      ),
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
            ...SIMPLE_ROUTING,
            ...NOT_AN_ALIAS,
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

  it('checks the CNAME apex and single-value rules before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderModal(
      <RecordSetModal zoneId="Z1" zoneName="example.com" onDismiss={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Record type/ }));
    await userEvent.click(screen.getByRole('option', { name: /CNAME/ }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Value' }),
      'one.example.com\ntwo.example.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create record' }));

    expect(
      screen.getByText('A CNAME record cannot be created at the zone apex.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A CNAME record must have exactly one value.'),
    ).toBeInTheDocument();
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
