import { describe, expect, it } from 'vitest';
import { validateComment, validateVpcId, validateZoneName } from './validation';

describe('validateZoneName', () => {
  it.each(['example.com', 'Example.COM.', '  _dmarc.example.com ', 'bücher.de'])(
    'accepts %s',
    (name) => {
      expect(validateZoneName(name)).toBeUndefined();
    },
  );

  it.each([
    ['', 'Enter a domain name.'],
    ['localhost', 'Enter a full domain name, such as example.com.'],
    ['a..com', "A domain name can't contain two dots in a row."],
    ['-a.com', '"-a" isn\'t valid'],
    ['example.123', "The last part of a domain name can't be only digits."],
    [`${'a'.repeat(64)}.com`, 'Each part between dots can have at most 63 characters.'],
  ])('rejects %j', (name, message) => {
    expect(validateZoneName(name)).toContain(message);
  });
});

describe('validateComment', () => {
  it('allows up to 256 characters', () => {
    expect(validateComment('x'.repeat(256))).toBeUndefined();
    expect(validateComment('x'.repeat(257))).toBeDefined();
  });
});

describe('validateVpcId', () => {
  it.each(['vpc-0a1b2c3d', 'vpc-0123456789abcdef0'])('accepts %s', (id) => {
    expect(validateVpcId(id)).toBeUndefined();
  });

  it.each(['', 'vpc-xyz', 'VPC-0A1B2C3D', 'vpc-0a1b2c3d4'])('rejects %j', (id) => {
    expect(validateVpcId(id)).toBeDefined();
  });
});
