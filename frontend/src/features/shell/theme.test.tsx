import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './theme';

const { applyMode } = vi.hoisted(() => ({ applyMode: vi.fn() }));
vi.mock('@cloudscape-design/global-styles', () => ({
  Mode: { Dark: 'dark', Light: 'light' },
  applyMode: (mode: string) => applyMode(mode),
}));

function ThemeControl() {
  const { mode, toggleMode } = useTheme();
  return <button onClick={toggleMode}>{mode}</button>;
}

beforeEach(() => {
  applyMode.mockClear();
  window.localStorage.clear();
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
});

describe('ThemeProvider', () => {
  it('uses the system preference when no choice has been saved', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );

    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>,
    );

    expect(screen.getByRole('button')).toHaveTextContent('dark');
    expect(applyMode).toHaveBeenCalledWith('dark');
  });

  it('restores and remembers an explicit color mode', async () => {
    window.localStorage.setItem('route53-color-mode', 'dark');
    render(
      <ThemeProvider>
        <ThemeControl />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('dark'));
    expect(applyMode).toHaveBeenCalledWith('dark');

    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('light');
    expect(window.localStorage.getItem('route53-color-mode')).toBe('light');
    expect(applyMode).toHaveBeenLastCalledWith('light');
  });
});
