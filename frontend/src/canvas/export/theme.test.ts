// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { withTheme } from './theme';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('exporting in a theme that is not the one on screen', () => {
  it('reads the theme it was asked for', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const seen = withTheme('dark', () => document.documentElement.getAttribute('data-theme'));
    expect(seen).toBe('dark');
  });

  // The attribute is on the document element, so leaving it wrong would
  // repaint the whole app in the other theme.
  it('puts the screen back afterwards', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    withTheme('dark', () => null);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('puts the screen back after a failure too', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    expect(() =>
      withTheme('light', () => {
        throw new Error('drawing failed');
      }),
    ).toThrow('drawing failed');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('restores no attribute at all when there was none', () => {
    withTheme('dark', () => null);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('hands the body a reader for that theme variables', () => {
    const read = withTheme('dark', (readVariable) => readVariable);
    expect(typeof read).toBe('function');
  });

  // Two swaps at once would each restore what the other set, and the app would
  // be left in whichever theme lost the race.
  it('refuses to nest', () => {
    expect(() => withTheme('dark', () => withTheme('light', () => null))).toThrow(/nest/i);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
