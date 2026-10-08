'use client';

import HelpPanel from '@cloudscape-design/components/help-panel';
import Link from '@cloudscape-design/components/link';
import { createContext, useContext } from 'react';
import { ROUTES } from './navigation';

const HelpContext = createContext<() => void>(() => {});

export const HelpContextProvider = HelpContext.Provider;

export function useHelpPanel() {
  return useContext(HelpContext);
}

interface HelpContent {
  title: string;
  body: string;
  documentation: string;
}

const DEFAULT_HELP: HelpContent = {
  title: 'Route 53 console',
  body: 'Use this console to create hosted zones and manage their DNS records.',
  documentation: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html',
};

const HELP_BY_PATH: Record<string, HelpContent> = {
  [ROUTES.dashboard]: {
    title: 'Route 53 dashboard',
    body: 'The dashboard gives you one place to reach each Route 53 feature.',
    documentation:
      'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html',
  },
  [ROUTES.hostedZones]: {
    title: 'Hosted zones',
    body: 'A hosted zone is a container for records that define how traffic is routed for a domain.',
    documentation:
      'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-working-with.html',
  },
  [ROUTES.trafficPolicies]: {
    title: 'Traffic policies',
    body: 'Traffic policies combine DNS records and routing rules in a reusable visual policy.',
    documentation:
      'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/traffic-flow.html',
  },
  [ROUTES.healthChecks]: {
    title: 'Health checks',
    body: 'Health checks monitor endpoints and can influence DNS routing decisions.',
    documentation:
      'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-failover.html',
  },
  [ROUTES.resolver]: {
    title: 'Route 53 Resolver',
    body: 'Resolver connects DNS queries between virtual private clouds and your network.',
    documentation:
      'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver.html',
  },
  [ROUTES.profiles]: {
    title: 'Route 53 Profiles',
    body: 'Profiles let you share DNS-related configurations across virtual private clouds.',
    documentation:
      'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/profiles.html',
  },
};

export function ConsoleHelp({ pathname }: { pathname: string }) {
  const content =
    (pathname.startsWith(`${ROUTES.hostedZones}/`)
      ? HELP_BY_PATH[ROUTES.hostedZones]
      : HELP_BY_PATH[pathname]) ?? DEFAULT_HELP;

  return (
    <HelpPanel
      header={<h2>{content.title}</h2>}
      footer={
        <>
          <h3>Learn more</h3>
          <Link href={content.documentation} external>
            AWS Route 53 documentation
          </Link>
        </>
      }
    >
      <p>{content.body}</p>
    </HelpPanel>
  );
}
