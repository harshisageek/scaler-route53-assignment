import { toApiError } from './errors';

/**
 * Requests go to a relative /api/v1 path, which Next.js rewrites to FastAPI.
 * Because it is same-origin, the session cookie rides along automatically.
 */
const API_PREFIX = '/api/v1';

type JsonBody = Record<string, unknown> | unknown[];

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: JsonBody;
  searchParams?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, searchParams?: RequestOptions['searchParams']): string {
  const url = `${API_PREFIX}${path}`;
  if (!searchParams) return url;

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const queryString = query.toString();
  return queryString ? `${url}?${queryString}` : url;
}

export async function apiRequest<TResponse>(
  path: string,
  { method = 'GET', body, searchParams, signal }: RequestOptions = {},
): Promise<TResponse> {
  const response = await fetch(buildUrl(path, searchParams), {
    method,
    signal,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) throw await toApiError(response);

  // 204 No Content is the normal reply to a successful delete.
  if (response.status === 204) return undefined as TResponse;

  return (await response.json()) as TResponse;
}

export async function apiUpload<TResponse>(path: string, file: File): Promise<TResponse> {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(buildUrl(path), {
    method: 'POST',
    credentials: 'same-origin',
    body,
  });

  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as TResponse;
}

export async function apiDownload(
  path: string,
  searchParams?: RequestOptions['searchParams'],
): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(buildUrl(path, searchParams), {
    credentials: 'same-origin',
  });
  if (!response.ok) throw await toApiError(response);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'download';
  return { blob: await response.blob(), fileName };
}
