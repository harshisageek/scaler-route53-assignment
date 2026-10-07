import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './errors';

function response(status: number, body: unknown): Response {
  return {
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('not json');
      return body;
    },
  } as Response;
}

describe('toApiError', () => {
  it('reads the code, message and details from the shared error shape', async () => {
    const error = await toApiError(
      response(409, {
        error: {
          code: 'HostedZoneNotEmpty',
          message: 'Delete the records first.',
          details: { remaining: 3 },
        },
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe('HostedZoneNotEmpty');
    expect(error.details).toEqual({ remaining: 3 });
  });

  it('falls back when the body is not our error shape', async () => {
    const error = await toApiError(response(502, '<html>Bad gateway</html>'));

    expect(error.code).toBe('UnexpectedError');
    expect(error.message).toContain('502');
  });

  it('falls back when the body is not JSON at all', async () => {
    const error = await toApiError(response(500, undefined));

    expect(error.code).toBe('UnexpectedError');
  });
});
