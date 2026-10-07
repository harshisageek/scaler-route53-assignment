/** The error shape every backend failure uses. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

/**
 * Turn a failed response into an ApiError.
 *
 * A response can fail before reaching our code at all -- a proxy timeout, say,
 * which returns HTML -- so the body is never assumed to be our error shape.
 */
export async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (isApiErrorBody(body)) {
    return new ApiError(
      response.status,
      body.error.code,
      body.error.message,
      body.error.details ?? {},
    );
  }

  return new ApiError(
    response.status,
    'UnexpectedError',
    `Request failed with status ${response.status}.`,
  );
}
