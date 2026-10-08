import { ROUTES } from '@/features/shell/navigation';

export const SIGN_IN_PATH = '/signin';
export const SIGN_UP_PATH = '/signup';

/**
 * Where to go after signing in. The `next` value comes from the URL, so it is
 * only honoured when it is a path on this site; anything else would let a
 * crafted link bounce a freshly signed-in user to another domain.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return ROUTES.hostedZones;
  }
  return next;
}

export function signInUrl(returnTo?: string): string {
  if (!returnTo || returnTo === ROUTES.hostedZones) return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?next=${encodeURIComponent(returnTo)}`;
}

/** AWS shows account IDs in groups of four: 1234-5678-9012. */
export function formatAccountId(accountId: string): string {
  return accountId.replace(/(\d{4})(?=\d)/g, '$1-');
}
