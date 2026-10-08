import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, breadcrumbsFor, zoneIdFromPath } from './navigation';

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

  it('names every main console destination', () => {
    expect(texts('/route53')).toEqual(['Route 53', 'Dashboard']);
    expect(texts('/route53/traffic-policies')).toEqual(['Route 53', 'Traffic policies']);
    expect(texts('/route53/health-checks')).toEqual(['Route 53', 'Health checks']);
    expect(texts('/route53/resolver')).toEqual(['Route 53', 'Resolver']);
    expect(texts('/route53/profiles')).toEqual(['Route 53', 'Profiles']);
  });
});

describe('zoneIdFromPath', () => {
  it('finds the ID only on a zone page', () => {
    expect(zoneIdFromPath('/route53/hosted-zones/Z123')).toBe('Z123');
    expect(zoneIdFromPath('/route53/hosted-zones/create')).toBeUndefined();
    expect(zoneIdFromPath('/route53/hosted-zones')).toBeUndefined();
  });
});

describe('side navigation', () => {
  it('links to every Route 53 destination', () => {
    expect(JSON.stringify(NAV_ITEMS)).toContain('Dashboard');
    expect(JSON.stringify(NAV_ITEMS)).toContain('Hosted zones');
    expect(JSON.stringify(NAV_ITEMS)).toContain('Traffic policies');
    expect(JSON.stringify(NAV_ITEMS)).toContain('Health checks');
    expect(JSON.stringify(NAV_ITEMS)).toContain('Resolver overview');
    expect(JSON.stringify(NAV_ITEMS)).toContain('Profiles');
  });
});
