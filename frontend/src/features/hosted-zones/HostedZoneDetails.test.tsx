import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HostedZoneDetail } from '@/lib/api/types';
import { HostedZoneDetails } from './HostedZoneDetails';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const PRIVATE_ZONE: HostedZoneDetail = {
  id: 'ZPRIVATE1234567890ABC',
  name: 'internal.example.com.',
  comment: 'Private VPC zone',
  private_zone: true,
  record_count: 2,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
  name_servers: ['ns-0.awsdns-00.com.', 'ns-512.awsdns-00.net.'],
  vpc: { region: 'eu-west-1', vpc_id: 'vpc-0a1b2c3d' },
};

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function renderDetails(zoneId: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HostedZoneDetails zoneId={zoneId} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HostedZoneDetails', () => {
  it('shows what Route 53 shows for a zone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, PRIVATE_ZONE)));

    renderDetails(PRIVATE_ZONE.id);

    expect(
      await screen.findByRole('heading', { name: 'internal.example.com', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('ZPRIVATE1234567890ABC')).toBeInTheDocument();
    expect(screen.getByText('Private hosted zone')).toBeInTheDocument();
    expect(screen.getByText('ns-512.awsdns-00.net.')).toBeInTheDocument();
    expect(screen.getByText('October 1, 2026 at 12:00 (UTC)')).toBeInTheDocument();
    expect(
      screen.getByText('vpc-0a1b2c3d (Europe (Ireland), eu-west-1)'),
    ).toBeInTheDocument();
  });

  it('says plainly when the zone does not exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(404, {
          error: { code: 'NoSuchHostedZone', message: 'No hosted zone.' },
        }),
      ),
    );

    renderDetails('ZMISSING');

    expect(
      await screen.findByText('No hosted zone found with ID ZMISSING.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Back to hosted zones' }),
    ).toBeInTheDocument();
  });
});
