import type { BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import type { SideNavigationProps } from '@cloudscape-design/components/side-navigation';

export const ROUTES = {
  home: '/route53',
  dashboard: '/route53',
  hostedZones: '/route53/hosted-zones',
  createHostedZone: '/route53/hosted-zones/create',
  hostedZone: (zoneId: string) => `/route53/hosted-zones/${encodeURIComponent(zoneId)}`,
  trafficPolicies: '/route53/traffic-policies',
  healthChecks: '/route53/health-checks',
  resolver: '/route53/resolver',
  profiles: '/route53/profiles',
} as const;

export const NAV_HEADER: SideNavigationProps.Header = {
  text: 'Route 53',
  href: ROUTES.home,
};

export const NAV_ITEMS: SideNavigationProps.Item[] = [
  { type: 'link', text: 'Dashboard', href: ROUTES.dashboard },
  { type: 'link', text: 'Hosted zones', href: ROUTES.hostedZones },
  { type: 'link', text: 'Traffic policies', href: ROUTES.trafficPolicies },
  { type: 'link', text: 'Health checks', href: ROUTES.healthChecks },
  { type: 'divider' },
  {
    type: 'section',
    text: 'Resolver',
    items: [{ type: 'link', text: 'Resolver overview', href: ROUTES.resolver }],
  },
  { type: 'link', text: 'Profiles', href: ROUTES.profiles },
];

const ROOT_CRUMB: BreadcrumbGroupProps.Item = { text: 'Route 53', href: ROUTES.home };
const ZONES_CRUMB: BreadcrumbGroupProps.Item = {
  text: 'Hosted zones',
  href: ROUTES.hostedZones,
};

const CRUMBS_BY_PATH: Record<string, BreadcrumbGroupProps.Item[]> = {
  [ROUTES.dashboard]: [ROOT_CRUMB, { text: 'Dashboard', href: ROUTES.dashboard }],
  [ROUTES.hostedZones]: [ROOT_CRUMB, ZONES_CRUMB],
  [ROUTES.createHostedZone]: [
    ROOT_CRUMB,
    ZONES_CRUMB,
    { text: 'Create hosted zone', href: ROUTES.createHostedZone },
  ],
  [ROUTES.trafficPolicies]: [
    ROOT_CRUMB,
    { text: 'Traffic policies', href: ROUTES.trafficPolicies },
  ],
  [ROUTES.healthChecks]: [
    ROOT_CRUMB,
    { text: 'Health checks', href: ROUTES.healthChecks },
  ],
  [ROUTES.resolver]: [ROOT_CRUMB, { text: 'Resolver', href: ROUTES.resolver }],
  [ROUTES.profiles]: [ROOT_CRUMB, { text: 'Profiles', href: ROUTES.profiles }],
};

const ZONE_PATH = /^\/route53\/hosted-zones\/([^/]+)$/;

/** The zone ID in a zone page's path, or undefined on any other page. */
export function zoneIdFromPath(pathname: string): string | undefined {
  if (pathname === ROUTES.createHostedZone) return undefined;
  const encoded = ZONE_PATH.exec(pathname)?.[1];
  return encoded ? decodeURIComponent(encoded) : undefined;
}

/**
 * Breadcrumbs for a page. A zone page shows the zone's name once it has
 * loaded, and its ID until then.
 */
export function breadcrumbsFor(
  pathname: string,
  zoneName?: string,
): BreadcrumbGroupProps.Item[] {
  const zoneId = zoneIdFromPath(pathname);
  if (zoneId) {
    return [ROOT_CRUMB, ZONES_CRUMB, { text: zoneName ?? zoneId, href: pathname }];
  }
  return CRUMBS_BY_PATH[pathname] ?? [ROOT_CRUMB];
}
