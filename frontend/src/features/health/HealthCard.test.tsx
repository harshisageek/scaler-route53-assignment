import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HealthCard } from './HealthCard';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function mockFetch(response: Partial<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response as Response));
}

describe('HealthCard', () => {
  it('shows the environment once the API answers', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok', environment: 'test', database: 'ok' }),
    });

    renderWithQueryClient(<HealthCard />);

    expect(await screen.findByText('test')).toBeInTheDocument();
  });

  it('surfaces the backend message when the API fails', async () => {
    mockFetch({
      ok: false,
      status: 503,
      json: async () => ({
        error: { code: 'ServiceUnavailable', message: 'Database is unreachable.' },
      }),
    });

    renderWithQueryClient(<HealthCard />);

    expect(await screen.findByText('Database is unreachable.')).toBeInTheDocument();
  });
});
