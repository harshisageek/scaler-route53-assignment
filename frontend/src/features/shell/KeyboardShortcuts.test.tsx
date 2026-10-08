import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyboardShortcuts } from './KeyboardShortcuts';

const goTo = vi.fn();
const closePanels = vi.fn();

function renderShortcuts(pathname = '/route53/hosted-zones') {
  return render(
    <>
      <input aria-label="Find hosted zones" />
      <KeyboardShortcuts pathname={pathname} goTo={goTo} closePanels={closePanels} />
    </>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('KeyboardShortcuts', () => {
  it('shows the shortcut reference with question mark and closes it with Escape', () => {
    renderShortcuts();

    fireEvent.keyDown(document, { key: '?' });
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
    expect(closePanels).toHaveBeenCalled();
  });

  it('focuses search, starts creation, and navigates with the go chord', () => {
    renderShortcuts();

    fireEvent.keyDown(document, { key: '/' });
    expect(screen.getByRole('textbox', { name: 'Find hosted zones' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'c' });
    expect(goTo).toHaveBeenCalledWith('/route53/hosted-zones/create');

    fireEvent.keyDown(document, { key: 'g' });
    fireEvent.keyDown(document, { key: 'z' });
    expect(goTo).toHaveBeenCalledWith('/route53/hosted-zones');
  });

  it('ignores shortcuts while the user is typing', async () => {
    renderShortcuts();
    const search = screen.getByRole('textbox', { name: 'Find hosted zones' });

    await userEvent.type(search, '?cgz');

    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).toBeNull();
    expect(goTo).not.toHaveBeenCalled();
  });
});
