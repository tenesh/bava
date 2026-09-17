/**
 * Theme state: light, dark, or follow the system.
 *
 * The resolved theme is written to `data-theme` on the document element, which
 * is what the token layer keys off. Persistence is a per-viewer convenience
 * (it lives in localStorage, never in a document), and every access is guarded,
 * because a private window or blocked site data makes localStorage throw.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'bava.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The parts of localStorage this module uses, so tests can supply their own. */
export type ThemeStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type MediaQuery = {
  matches: boolean;
  addEventListener(type: 'change', fn: (e: { matches: boolean }) => void): void;
  removeEventListener(type: 'change', fn: (e: { matches: boolean }) => void): void;
};

export type ThemeOptions = {
  storage?: ThemeStorage;
  matchMedia?: (query: string) => MediaQuery;
};

function isChoice(value: unknown): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function createTheme(options: ThemeOptions = {}) {
  const storage = options.storage ?? safeLocalStorage();
  const matchMedia = options.matchMedia ?? globalThis.matchMedia?.bind(globalThis);

  let mql: MediaQuery | undefined = matchMedia?.(DARK_QUERY);
  let onSystemChange: ((e: { matches: boolean }) => void) | undefined;

  let choice = $state<ThemeChoice>(readChoice(storage));
  let systemIsDark = $state(mql?.matches ?? false);

  const resolved = $derived<ResolvedTheme>(
    choice === 'system' ? (systemIsDark ? 'dark' : 'light') : choice,
  );

  // Written imperatively rather than from an $effect: an effect flushes on the
  // next microtask, so the document would paint once with the wrong theme
  // before the attribute landed. This module owns a DOM side effect; doing it
  // explicitly is both synchronous and honest about that.
  function apply() {
    globalThis.document?.documentElement.setAttribute('data-theme', resolved);
  }

  if (mql) {
    onSystemChange = (e) => {
      systemIsDark = e.matches;
      apply();
    };
    mql.addEventListener('change', onSystemChange);
  }

  apply();

  return {
    get choice() {
      return choice;
    },
    get resolved() {
      return resolved;
    },

    set(next: ThemeChoice) {
      choice = next;
      apply();
      try {
        storage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Persisting is a convenience. Losing it must not lose the theme.
      }
    },

    /** Call from a component's cleanup return. */
    destroy() {
      if (mql && onSystemChange) mql.removeEventListener('change', onSystemChange);
      mql = undefined;
      onSystemChange = undefined;
    },
  };
}

function readChoice(storage: ThemeStorage): ThemeChoice {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isChoice(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function safeLocalStorage(): ThemeStorage {
  return {
    getItem: (key) => globalThis.localStorage.getItem(key),
    setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  };
}
