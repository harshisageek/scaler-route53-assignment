import type { BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import type { SideNavigationProps } from '@cloudscape-design/components/side-navigation';

export const ROUTES = {
  home: '/route53',
  hostedZones: '/route53/hosted-zones',
} as const;

export const NAV_HEADER: SideNavigationProps.Header = {
  text: 'Route 53',
  href: ROUTES.home,
};

export const NAV_ITEMS: SideNavigationProps.Item[] = [
  { type: 'link', text: 'Hosted zones', href: ROUTES.hostedZones },
];

const ROOT_CRUMB: BreadcrumbGroupProps.Item = { text: 'Route 53', href: ROUTES.home };

const CRUMBS_BY_PATH: Record<string, BreadcrumbGroupProps.Item[]> = {
  [ROUTES.hostedZones]: [ROOT_CRUMB, { text: 'Hosted zones', href: ROUTES.hostedZones }],
};

export function breadcrumbsFor(pathname: string): BreadcrumbGroupProps.Item[] {
  return CRUMBS_BY_PATH[pathname] ?? [ROOT_CRUMB];
}
