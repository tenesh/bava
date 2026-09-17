/**
 * Pane widths, as percentages of the shell.
 *
 * A per-viewer convenience, so it lives in localStorage and every access is
 * guarded: a private window or blocked site data makes it throw, and losing
 * the layout must never cost more than the layout.
 */
export const PANE_SIZES_KEY = 'bava.pane-sizes';

export type PaneSizes = {
  files: number;
  main: number;
  ai: number;
};

export type PaneSizesStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type PaneSizesOptions = {
  storage?: PaneSizesStorage;
  defaults: PaneSizes;
};

/** Anything not shaped like PaneSizes is discarded rather than patched. */
function parse(raw: string | null): PaneSizes | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const candidate = value as Record<string, unknown>;
    for (const pane of ['files', 'main', 'ai'] as const) {
      if (typeof candidate[pane] !== 'number') return null;
    }
    return candidate as unknown as PaneSizes;
  } catch {
    return null;
  }
}

export function createPaneSizes(options: PaneSizesOptions) {
  const storage = options.storage ?? safeLocalStorage();

  let current = $state.raw<PaneSizes>(read());

  function read(): PaneSizes {
    try {
      return parse(storage.getItem(PANE_SIZES_KEY)) ?? options.defaults;
    } catch {
      return options.defaults;
    }
  }

  return {
    get current() {
      return current;
    },

    set(next: PaneSizes) {
      current = next;
      try {
        storage.setItem(PANE_SIZES_KEY, JSON.stringify(next));
      } catch {
        // The layout still applies for this session; only persistence is lost.
      }
    },
  };
}

function safeLocalStorage(): PaneSizesStorage {
  return {
    getItem: (key) => globalThis.localStorage.getItem(key),
    setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  };
}
