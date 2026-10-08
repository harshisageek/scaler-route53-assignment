import { ApiError } from './errors';

interface ValidationIssue {
  loc?: unknown;
  msg?: unknown;
}

/**
 * Turn a 422 from the API into messages keyed by field path, such as "name"
 * or "vpc.vpc_id". An error about the request as a whole is keyed "".
 * Only the first message for each field is kept, which is what a form shows.
 */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.code !== 'ValidationFailed') return {};
  const issues = error.details.fields;
  if (!Array.isArray(issues)) return {};

  const result: Record<string, string> = {};
  for (const issue of issues as ValidationIssue[]) {
    if (!Array.isArray(issue.loc) || typeof issue.msg !== 'string') continue;
    const path = issue.loc
      .filter((part, index) => !(index === 0 && part === 'body'))
      .join('.');
    result[path] ??= issue.msg;
  }
  return result;
}
