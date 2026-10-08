import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/lib/api/types';
import { AuthForm, type AuthMode } from './AuthForm';

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const USER: User = {
  email: 'alice@example.com',
  account_id: '123456789012',
  is_demo: false,
  created_at: '2026-10-01T12:00:00Z',
};

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function apiError(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message, details: {} } });
}

function renderForm(mode: AuthMode, next?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthForm mode={mode} next={next} />
    </QueryClientProvider>,
  );
}

async function fillIn(label: string, value: string) {
  await userEvent.type(screen.getByLabelText(label), value);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AuthForm sign-in', () => {
  it('checks the fields before calling the API', async () => {
    renderForm('signin');

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs in and returns to the page the visitor asked for', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, USER));
    renderForm('signin', '/route53/hosted-zones/Z1');

    await fillIn('Email address', 'alice@example.com');
    await fillIn('Password', 'correct horse battery');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/route53/hosted-zones/Z1'),
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/sign-in');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'alice@example.com',
      password: 'correct horse battery',
    });
  });

  it('ignores a next link that points at another site', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, USER));
    renderForm('signin', 'https://evil.example');

    await fillIn('Email address', 'alice@example.com');
    await fillIn('Password', 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/route53/hosted-zones'),
    );
  });

  it('shows the server message when the password is wrong', async () => {
    fetchMock.mockResolvedValue(
      apiError(401, 'InvalidCredentials', 'Incorrect email or password.'),
    );
    renderForm('signin');

    await fillIn('Email address', 'alice@example.com');
    await fillIn('Password', 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('opens the demo account without asking for credentials', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...USER, is_demo: true }));
    renderForm('signin');

    await userEvent.click(screen.getByRole('button', { name: 'Try the demo' }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/route53/hosted-zones'),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/auth/demo');
  });
});

describe('AuthForm sign-up', () => {
  it('asks for a long enough, confirmed password', async () => {
    renderForm('signup');

    await fillIn('Email address', 'alice@example.com');
    await fillIn('Password', 'short');
    await fillIn('Confirm password', 'different');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('puts a duplicate email error on the email field', async () => {
    fetchMock.mockResolvedValue(
      apiError(
        409,
        'EmailAlreadyRegistered',
        'An account with this email already exists.',
      ),
    );
    renderForm('signup');

    await fillIn('Email address', 'alice@example.com');
    await fillIn('Password', 'long enough');
    await fillIn('Confirm password', 'long enough');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('An account with this email already exists.'),
    ).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
