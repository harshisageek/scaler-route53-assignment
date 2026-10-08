import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FlashMessages, FlashProvider, useFlash } from './flash';

let pathname = '/a';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

function Triggers() {
  const notify = useFlash();
  return (
    <>
      <button onClick={() => notify({ type: 'success', content: 'Saved.' })}>Save</button>
      <button
        onClick={() => notify({ type: 'success', content: 'Created.', showOn: '/b' })}
      >
        Create
      </button>
    </>
  );
}

function renderFlash() {
  pathname = '/a';
  const tree = () => (
    <FlashProvider>
      <Triggers />
      <FlashMessages />
    </FlashProvider>
  );
  const view = render(tree());
  return {
    goTo: (path: string) => {
      pathname = path;
      view.rerender(tree());
    },
  };
}

const gone = (text: string) =>
  waitFor(() => expect(screen.queryByText(text)).not.toBeInTheDocument());

describe('flash messages', () => {
  it('shows a message on its page and clears it when the user moves on', async () => {
    const { goTo } = renderFlash();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Saved.')).toBeInTheDocument();

    goTo('/b');
    await gone('Saved.');
    goTo('/a');
    await gone('Saved.');
  });

  it('holds a message for the page it was raised for', async () => {
    const { goTo } = renderFlash();

    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.queryByText('Created.')).not.toBeInTheDocument();

    goTo('/b');
    expect(await screen.findByText('Created.')).toBeInTheDocument();
    goTo('/c');
    await gone('Created.');
  });
});
