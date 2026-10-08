import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleLayout } from './ConsoleLayout';

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/route53/hosted-zones/Z1',
}));
vi.mock('./theme', () => ({
  useTheme: () => ({ mode: 'light', toggleMode: vi.fn() }),
}));

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConsoleLayout>
        <p>Page content</p>
      </ConsoleLayout>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ConsoleLayout', () => {
  it('shows the signed-in user, their account ID and the zone in the breadcrumbs', async () => {
    const responses: Record<string, unknown> = {
      '/api/v1/auth/me': {
        email: 'alice@example.com',
        account_id: '123456789012',
        is_demo: false,
        created_at: '2026-10-01T12:00:00Z',
      },
      '/api/v1/hosted-zones/Z1': { id: 'Z1', name: 'example.com.' },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => Promise.resolve(jsonResponse(200, responses[url]))),
    );

    renderLayout();

    expect(await screen.findByText('Page content')).toBeInTheDocument();
    expect(screen.getAllByText('alice@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Account ID: 1234-5678-9012').length).toBeGreaterThan(0);
    expect((await screen.findAllByText('example.com')).length).toBeGreaterThan(0);
  });

  it('sends a signed-out visitor to sign in without showing the page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(401, {
          error: { code: 'NotAuthenticated', message: 'Sign in to continue.' },
        }),
      ),
    );

    renderLayout();

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        '/signin?next=%2Froute53%2Fhosted-zones%2FZ1',
      ),
    );
    expect(screen.queryByText('Page content')).not.toBeInTheDocument();
  });
});
