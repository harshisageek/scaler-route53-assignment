import { describe, expect, it } from 'vitest';
import { displayZoneName, displayZoneType } from './format';

describe('displayZoneName', () => {
  it('drops the trailing dot of a fully qualified name', () => {
    expect(displayZoneName('example.com.')).toBe('example.com');
  });

  it('leaves a name without a trailing dot alone', () => {
    expect(displayZoneName('example.com')).toBe('example.com');
  });

  it('keeps the root zone readable', () => {
    expect(displayZoneName('.')).toBe('.');
  });
});

describe('displayZoneType', () => {
  it('labels zones the way the console does', () => {
    expect(displayZoneType(false)).toBe('Public');
    expect(displayZoneType(true)).toBe('Private');
  });
});
