/**
 * Recently opened files.
 *
 * A per-viewer convenience, so localStorage rather than a file — it is not
 * work product, and losing it costs nothing but a click. Every access is
 * guarded because a private window makes localStorage throw.
 */
export const RECENTS_KEY = 'bava.recents';
export const RECENTS_LIMIT = 10;

export type RecentsStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    if (!value.every((entry) => typeof entry === 'string')) return [];
    return value.slice(0, RECENTS_LIMIT);
  } catch {
    return [];
  }
}

export function createRecents(options: { storage?: RecentsStorage } = {}) {
  const storage = options.storage ?? safeLocalStorage();

  let paths = $state.raw<string[]>(read());

  function read(): string[] {
    try {
      return parse(storage.getItem(RECENTS_KEY));
    } catch {
      return [];
    }
  }

  return {
    get paths() {
      return paths;
    },

    add(path: string) {
      paths = [path, ...paths.filter((existing) => existing !== path)].slice(0, RECENTS_LIMIT);
      try {
        storage.setItem(RECENTS_KEY, JSON.stringify(paths));
      } catch {
        // The list holds for this session; only persistence is lost.
      }
    },
  };
}

function safeLocalStorage(): RecentsStorage {
  return {
    getItem: (key) => globalThis.localStorage.getItem(key),
    setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  };
}
