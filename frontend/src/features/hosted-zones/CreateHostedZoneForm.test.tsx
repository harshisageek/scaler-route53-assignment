import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlashMessages, FlashProvider } from '@/features/shell/flash';
import type { HostedZoneDetail } from '@/lib/api/types';
import { CreateHostedZoneForm } from './CreateHostedZoneForm';

let pathname = '/route53/hosted-zones/create';
const router = {
  push: vi.fn((href: string) => {
    pathname = href;
  }),
};
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));

const CREATED: HostedZoneDetail = {
  id: 'ZNEW1234567890ABCDEFG',
  name: 'example.com.',
  comment: 'Production',
  private_zone: false,
  record_count: 2,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
  name_servers: ['ns-1.awsdns-00.com.'],
  vpc: null,
};

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <FlashProvider>
        <FlashMessages />
        <CreateHostedZoneForm />
      </FlashProvider>
    </QueryClientProvider>
  );
  const view = render(tree());
  return { navigated: () => view.rerender(tree()) };
}

const submit = () =>
  userEvent.click(screen.getByRole('button', { name: 'Create hosted zone' }));
const sentBody = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  pathname = '/route53/hosted-zones/create';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('CreateHostedZoneForm', () => {
  it('creates a public zone, says so, and opens it', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, CREATED));
    const { navigated } = renderForm();

    await userEvent.type(screen.getByLabelText('Domain name'), 'example.com');
    await userEvent.type(
      screen.getByRole('textbox', { name: /Description/ }),
      ' Production ',
    );
    await submit();

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        '/route53/hosted-zones/ZNEW1234567890ABCDEFG',
      ),
    );
    expect(sentBody(fetchMock)).toEqual({
      name: 'example.com',
      comment: 'Production',
      private_zone: false,
      vpc: null,
      tags: [],
    });
    navigated();
    expect(
      await screen.findByText('example.com was successfully created.'),
    ).toBeInTheDocument();
  });

  it('checks the domain name before calling the API', async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText('Domain name'), 'localhost');
    await submit();

    expect(
      screen.getByText('Enter a full domain name, such as example.com.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts description characters like the console', async () => {
    renderForm();

    await userEvent.type(screen.getByRole('textbox', { name: /Description/ }), 'abc');

    expect(
      screen.getByText('The description can have up to 256 characters. 3/256'),
    ).toBeInTheDocument();
  });

  it('asks for a VPC only when the zone is private', async () => {
    renderForm();
    expect(screen.queryByLabelText('VPC ID')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Private hosted zone/ }));
    await userEvent.type(screen.getByLabelText('Domain name'), 'internal.example.com');
    await submit();

    expect(screen.getByText('Choose a Region.')).toBeInTheDocument();
    expect(screen.getByText('Enter a VPC ID.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the server message on the field it belongs to', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        error: {
          code: 'ValidationFailed',
          message: 'One or more fields are invalid.',
          details: { fields: [{ loc: ['body', 'name'], msg: 'Server says no.' }] },
        },
      }),
    );
    renderForm();

    await userEvent.type(screen.getByLabelText('Domain name'), 'example.com');
    await submit();

    expect(await screen.findByText('Server says no.')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
