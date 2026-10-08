'use client';

import Flashbar, { type FlashbarProps } from '@cloudscape-design/components/flashbar';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface FlashMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  content: ReactNode;
  /** The page to show it on, when it is raised just before navigating there. */
  showOn?: string;
}

interface FlashEntry {
  page: string;
  item: FlashbarProps.MessageDefinition;
}

interface FlashState {
  items: FlashbarProps.MessageDefinition[];
  notify: (message: FlashMessage) => void;
}

const FlashContext = createContext<FlashState | null>(null);

/**
 * The green and red banners at the top of the console. Each one belongs to a
 * page, as in the AWS console: "zone created" is raised on the create page,
 * shown on the zone's page, and cleared as soon as the user moves on.
 */
export function FlashProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [entries, setEntries] = useState<FlashEntry[]>([]);
  const [shownPathname, setShownPathname] = useState(pathname);
  const nextId = useRef(0);

  if (pathname !== shownPathname) {
    setShownPathname(pathname);
    setEntries((current) => current.filter((entry) => entry.page === pathname));
  }

  const notify = useCallback(
    ({ showOn, ...message }: FlashMessage) => {
      const id = `flash-${(nextId.current += 1)}`;
      const dismiss = () =>
        setEntries((current) => current.filter((e) => e.item.id !== id));
      const item = {
        ...message,
        id,
        dismissible: true,
        dismissLabel: 'Dismiss',
        onDismiss: dismiss,
      };
      setEntries((current) => [{ page: showOn ?? pathname, item }, ...current]);
    },
    [pathname],
  );

  const items = useMemo(
    () => entries.filter((entry) => entry.page === pathname).map((entry) => entry.item),
    [entries, pathname],
  );
  const value = useMemo(() => ({ items, notify }), [items, notify]);
  return <FlashContext.Provider value={value}>{children}</FlashContext.Provider>;
}

export function FlashMessages() {
  const state = useContext(FlashContext);
  return <Flashbar items={state?.items ?? []} />;
}

export function useFlash(): FlashState['notify'] {
  const state = useContext(FlashContext);
  if (!state) throw new Error('useFlash must be used inside FlashProvider');
  return state.notify;
}
