import { describe, expect, it } from 'vitest';
import { breadcrumbsFor, zoneIdFromPath } from './navigation';

const texts = (pathname: string, zoneName?: string) =>
  breadcrumbsFor(pathname, zoneName).map((crumb) => crumb.text);

describe('breadcrumbsFor', () => {
  it('follows the console path to the create page', () => {
    expect(texts('/route53/hosted-zones/create')).toEqual([
      'Route 53',
      'Hosted zones',
      'Create hosted zone',
    ]);
  });

  it('names a zone page after the zone once it is known', () => {
    expect(texts('/route53/hosted-zones/Z123')).toEqual([
      'Route 53',
      'Hosted zones',
      'Z123',
    ]);
    expect(texts('/route53/hosted-zones/Z123', 'example.com')).toEqual([
      'Route 53',
      'Hosted zones',
      'example.com',
    ]);
  });
});

describe('zoneIdFromPath', () => {
  it('finds the ID only on a zone page', () => {
    expect(zoneIdFromPath('/route53/hosted-zones/Z123')).toBe('Z123');
    expect(zoneIdFromPath('/route53/hosted-zones/create')).toBeUndefined();
    expect(zoneIdFromPath('/route53/hosted-zones')).toBeUndefined();
  });
});
