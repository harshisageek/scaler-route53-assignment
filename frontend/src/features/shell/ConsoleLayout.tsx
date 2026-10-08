'use client';

import AppLayout, { type AppLayoutProps } from '@cloudscape-design/components/app-layout';
import Box from '@cloudscape-design/components/box';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Button from '@cloudscape-design/components/button';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useMe, useSignOut } from '@/features/auth/api';
import { SIGN_IN_PATH, formatAccountId, signInUrl } from '@/features/auth/redirect';
import { useHostedZone } from '@/features/hosted-zones/api';
import { displayZoneName } from '@/features/hosted-zones/format';
import { ApiError } from '@/lib/api/errors';
import type { User } from '@/lib/api/types';
import { FlashMessages, FlashProvider } from './flash';
import {
  NAV_HEADER,
  NAV_ITEMS,
  ROUTES,
  breadcrumbsFor,
  zoneIdFromPath,
} from './navigation';

type FollowEvent = CustomEvent<{ href?: string; external?: boolean }>;

/**
 * The console frame: top bar, side navigation, breadcrumbs and the content area.
 *
 * Nothing inside renders until the signed-in user is known, so a signed-out
 * visitor never sees an empty console flash before the redirect.
 *
 * Cloudscape renders plain anchors, so internal links are intercepted and
 * handed to the Next.js router to avoid full page reloads.
 */
export function ConsoleLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const signedOut = me.error instanceof ApiError && me.error.status === 401;

  useEffect(() => {
    if (signedOut) router.replace(signInUrl(pathname));
  }, [signedOut, router, pathname]);

  if (me.data && !signedOut) return <Console user={me.data}>{children}</Console>;

  if (me.error && !signedOut) {
    return (
      <CenteredMessage>
        <StatusIndicator type="error">{me.error.message}</StatusIndicator>
        <Button onClick={() => void me.refetch()}>Retry</Button>
      </CenteredMessage>
    );
  }

  return (
    <CenteredMessage>
      <Spinner size="large" />
    </CenteredMessage>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <Box textAlign="center" padding={{ top: 'xxxl' }}>
      <SpaceBetween size="s" alignItems="center">
        {children}
      </SpaceBetween>
    </Box>
  );
}

function Console({ user, children }: { user: User; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const signOut = useSignOut();
  const [navigationOpen, setNavigationOpen] = useState(true);

  const followInternal = (event: FollowEvent) => {
    const { href, external } = event.detail;
    if (external || !href) return;
    event.preventDefault();
    router.push(href);
  };

  const accountId = formatAccountId(user.account_id);
  const zone = useHostedZone(zoneIdFromPath(pathname));
  const zoneName = zone.data ? displayZoneName(zone.data.name) : undefined;

  return (
    <FlashProvider>
      <div id="top-nav">
        <TopNavigation
          identity={{
            href: ROUTES.home,
            title: 'Route 53 Console',
            onFollow: (event) => {
              event.preventDefault();
              router.push(ROUTES.home);
            },
          }}
          utilities={[
            {
              type: 'menu-dropdown',
              text: user.email,
              description: user.is_demo
                ? `Demo account · ${accountId}`
                : `Account ID: ${accountId}`,
              iconName: 'user-profile',
              items: [{ id: 'sign-out', text: 'Sign out' }],
              onItemClick: ({ detail }) => {
                if (detail.id !== 'sign-out') return;
                signOut.mutate(undefined, {
                  onSettled: () => router.replace(SIGN_IN_PATH),
                });
              },
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#top-nav"
        contentType={contentTypeFor(pathname)}
        toolsHide
        notifications={<FlashMessages />}
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        navigation={
          <SideNavigation
            header={NAV_HEADER}
            items={NAV_ITEMS}
            activeHref={pathname}
            onFollow={followInternal}
          />
        }
        breadcrumbs={
          <BreadcrumbGroup
            items={breadcrumbsFor(pathname, zoneName)}
            ariaLabel="Breadcrumbs"
            onFollow={followInternal}
          />
        }
        content={children}
      />
    </FlashProvider>
  );
}

function contentTypeFor(pathname: string): AppLayoutProps.ContentType {
  if (pathname === ROUTES.hostedZones) return 'table';
  if (pathname === ROUTES.createHostedZone) return 'form';
  return 'default';
}
