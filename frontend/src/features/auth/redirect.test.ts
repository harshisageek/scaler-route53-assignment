import { describe, expect, it } from 'vitest';
import { formatAccountId, safeNextPath, signInUrl } from './redirect';

describe('safeNextPath', () => {
  it('keeps a path on this site', () => {
    expect(safeNextPath('/route53/hosted-zones/Z123')).toBe('/route53/hosted-zones/Z123');
  });

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'route53',
  ])('falls back to the hosted zones list for %s', (next) => {
    expect(safeNextPath(next)).toBe('/route53/hosted-zones');
  });
});

describe('signInUrl', () => {
  it('omits the default destination', () => {
    expect(signInUrl('/route53/hosted-zones')).toBe('/signin');
  });

  it('remembers any other page', () => {
    expect(signInUrl('/route53/hosted-zones/Z1?tab=records')).toBe(
      '/signin?next=%2Froute53%2Fhosted-zones%2FZ1%3Ftab%3Drecords',
    );
  });
});

describe('formatAccountId', () => {
  it('groups digits in fours like the AWS console', () => {
    expect(formatAccountId('123456789012')).toBe('1234-5678-9012');
  });
});
