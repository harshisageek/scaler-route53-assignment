'use client';

import AppLayout from '@cloudscape-design/components/app-layout';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { NAV_HEADER, NAV_ITEMS, breadcrumbsFor } from './navigation';

/**
 * The console frame: side navigation, breadcrumbs and the content area.
 *
 * Cloudscape renders plain anchors, so internal links are intercepted and
 * handed to the Next.js router to avoid full page reloads.
 */
export function ConsoleLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(true);

  const followInternal = (event: CustomEvent<{ href?: string; external?: boolean }>) => {
    const { href, external } = event.detail;
    if (external || !href) return;
    event.preventDefault();
    router.push(href);
  };

  return (
    <AppLayout
      contentType="table"
      toolsHide
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
          items={breadcrumbsFor(pathname)}
          ariaLabel="Breadcrumbs"
          onFollow={followInternal}
        />
      }
      content={children}
    />
  );
}
