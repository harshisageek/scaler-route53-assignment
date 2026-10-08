'use client';

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useEffect, useRef, useState } from 'react';
import { ROUTES } from './navigation';

interface Props {
  pathname: string;
  goTo: (href: string) => void;
  closePanels: () => void;
}

const shortcuts = [
  ['/', 'Focus the current table search'],
  ['c', 'Create a hosted zone or record'],
  ['g then z', 'Go to hosted zones'],
  ['?', 'Show keyboard shortcuts'],
  ['Esc', 'Close this dialog or the help panel'],
] as const;

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.matches('input, textarea, select') ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
}

function clickCreateAction() {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) =>
      !candidate.disabled &&
      ['Create hosted zone', 'Create record'].includes(
        candidate.textContent?.trim() ?? '',
      ),
  );
  button?.click();
}

export function KeyboardShortcuts({ pathname, goTo, closePanels }: Props) {
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingGo = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const resetGo = () => {
      pendingGo.current = false;
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target))
        return;

      if (event.key === 'Escape') {
        setHelpOpen(false);
        closePanels();
        resetGo();
        return;
      }
      if (event.key === '?') {
        event.preventDefault();
        setHelpOpen(true);
        resetGo();
        return;
      }
      if (pendingGo.current) {
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          goTo(ROUTES.hostedZones);
        }
        resetGo();
        return;
      }
      if (event.key.toLowerCase() === 'g') {
        pendingGo.current = true;
        resetTimer.current = setTimeout(resetGo, 1000);
        return;
      }
      if (event.key === '/') {
        const search = document.querySelector<HTMLInputElement>(
          'input[aria-label^="Find "]',
        );
        if (search) {
          event.preventDefault();
          search.focus();
        }
        return;
      }
      if (event.key.toLowerCase() === 'c') {
        if (pathname === ROUTES.hostedZones) {
          event.preventDefault();
          goTo(ROUTES.createHostedZone);
        } else if (/^\/route53\/hosted-zones\/[^/]+$/.test(pathname)) {
          event.preventDefault();
          clickCreateAction();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      resetGo();
    };
  }, [closePanels, goTo, pathname]);

  if (!helpOpen) return null;

  return (
    <Modal
      visible
      onDismiss={() => setHelpOpen(false)}
      closeAriaLabel="Close keyboard shortcuts"
      header="Keyboard shortcuts"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={() => setHelpOpen(false)}>
            Close
          </Button>
        </Box>
      }
    >
      <SpaceBetween size="s">
        {shortcuts.map(([keys, description]) => (
          <div className="shortcut-row" key={keys}>
            <kbd>{keys}</kbd>
            <span>{description}</span>
          </div>
        ))}
      </SpaceBetween>
    </Modal>
  );
}
