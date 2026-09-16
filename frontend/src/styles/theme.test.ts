// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createTheme, THEME_STORAGE_KEY } from './theme.svelte';

/** A matchMedia stand-in whose value can be changed to fire a system change. */
function fakeMedia(dark: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches: dark,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => void listeners.add(fn),
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
      void listeners.delete(fn),
  };
  return {
    matchMedia: () => mql,
    set(value: boolean) {
      mql.matches = value;
      for (const fn of listeners) fn({ matches: value });
    },
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

/** Private browsing and blocked site data both make these throw. */
const throwingStorage = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('SecurityError');
  },
};

describe('theme', () => {
  it('follows the system preference when the choice is system', () => {
    const media = fakeMedia(true);
    const theme = createTheme({ storage: memoryStorage(), matchMedia: media.matchMedia });
    expect(theme.choice).toBe('system');
    expect(theme.resolved).toBe('dark');
    theme.destroy();
  });

  it('lets an explicit choice override the system preference', () => {
    const media = fakeMedia(true);
    const theme = createTheme({ storage: memoryStorage(), matchMedia: media.matchMedia });
    theme.set('light');
    expect(theme.resolved).toBe('light');
    theme.destroy();
  });

  // The whole point of following the system is that it keeps following it.
  it('updates the resolved theme when the system changes while following', () => {
    const media = fakeMedia(false);
    const theme = createTheme({ storage: memoryStorage(), matchMedia: media.matchMedia });
    expect(theme.resolved).toBe('light');
    media.set(true);
    expect(theme.resolved).toBe('dark');
    theme.destroy();
  });

  it('stops following the system once a choice is made', () => {
    const media = fakeMedia(false);
    const theme = createTheme({ storage: memoryStorage(), matchMedia: media.matchMedia });
    theme.set('light');
    media.set(true);
    expect(theme.resolved).toBe('light');
    theme.destroy();
  });

  it('restores a persisted choice', () => {
    const media = fakeMedia(false);
    const theme = createTheme({
      storage: memoryStorage({ [THEME_STORAGE_KEY]: 'dark' }),
      matchMedia: media.matchMedia,
    });
    expect(theme.choice).toBe('dark');
    expect(theme.resolved).toBe('dark');
    theme.destroy();
  });

  it('persists a choice', () => {
    const storage = memoryStorage();
    const spy = vi.spyOn(storage, 'setItem');
    const theme = createTheme({ storage, matchMedia: fakeMedia(false).matchMedia });
    theme.set('dark');
    expect(spy).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark');
    theme.destroy();
  });

  // localStorage throws in a private window or with site data blocked. Theming
  // is a convenience; it must never take the app down with it.
  it('falls back to the system preference when storage throws', () => {
    const media = fakeMedia(true);
    const theme = createTheme({ storage: throwingStorage, matchMedia: media.matchMedia });
    expect(theme.choice).toBe('system');
    expect(theme.resolved).toBe('dark');
    expect(() => theme.set('light')).not.toThrow();
    expect(theme.resolved).toBe('light');
    theme.destroy();
  });

  it('ignores a persisted value that is not a theme', () => {
    const theme = createTheme({
      storage: memoryStorage({ [THEME_STORAGE_KEY]: 'chartreuse' }),
      matchMedia: fakeMedia(false).matchMedia,
    });
    expect(theme.choice).toBe('system');
    theme.destroy();
  });

  // The tokens key off `[data-theme="dark"]`, so the attribute is the whole
  // point of this module.
  it('writes the resolved theme to the document element', () => {
    const media = fakeMedia(true);
    const theme = createTheme({ storage: memoryStorage(), matchMedia: media.matchMedia });
    expect(document.documentElement.dataset.theme).toBe('dark');
    theme.set('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    theme.destroy();
  });

  it('stops listening after destroy', () => {
    const media = fakeMedia(false);
    const theme = createTheme({ storage: memoryStorage(), matchMedia: media.matchMedia });
    theme.destroy();
    media.set(true);
    expect(theme.resolved).toBe('light');
  });
});
