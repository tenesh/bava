/**
 * Recently opened Spaces and files.
 *
 * A per-viewer convenience, so localStorage rather than a file: it is not
 * work product, and losing it costs nothing but a click. Every access is
 * guarded because a private window makes localStorage throw.
 */
export const RECENTS_KEY = 'bava.recents';
export const RECENTS_LIMIT = 10;

export type RecentsStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type RecentKind = 'space' | 'file';
export type Recent = { path: string; kind: RecentKind; openedAt: number };

function isRecent(value: unknown): value is Recent {
  const r = value as Recent;
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.path === 'string' &&
    (r.kind === 'space' || r.kind === 'file') &&
    typeof r.openedAt === 'number'
  );
}

/** Whether a path is a folder's own path or inside it. */
function under(folder: string, path: string): boolean {
  return path === folder || path.startsWith(folder + '/') || path.startsWith(folder + '\\');
}

function parse(raw: string | null): Recent[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    // Older versions kept file paths only.
    if (value.every((entry) => typeof entry === 'string')) {
      return value.slice(0, RECENTS_LIMIT).map((path: string) => ({ path, kind: 'file', openedAt: 0 }));
    }
    if (!value.every(isRecent)) return [];
    return value;
  } catch {
    return [];
  }
}

export function createRecents(options: { storage?: RecentsStorage; now?: () => number } = {}) {
  const storage = options.storage ?? safeLocalStorage();
  const now = options.now ?? (() => Date.now());

  let entries = $state.raw<Recent[]>(read());

  function read(): Recent[] {
    try {
      return parse(storage.getItem(RECENTS_KEY));
    } catch {
      return [];
    }
  }

  function write(next: Recent[]) {
    // Each kind keeps its own ten: opening pages never pushes a Space off.
    const counts = { space: 0, file: 0 };
    entries = next.filter((entry) => (counts[entry.kind] += 1) <= RECENTS_LIMIT);
    try {
      storage.setItem(RECENTS_KEY, JSON.stringify(entries));
    } catch {
      // The list holds for this session; only persistence is lost.
    }
  }

  return {
    /** Most recent first. */
    get entries() {
      return entries;
    },
    get paths() {
      return entries.map((entry) => entry.path);
    },
    get spaces() {
      return entries.filter((entry) => entry.kind === 'space');
    },
    kindOf(path: string): RecentKind | undefined {
      return entries.find((entry) => entry.path === path)?.kind;
    },

    add(path: string, kind: RecentKind = 'file') {
      write([{ path, kind, openedAt: now() }, ...entries.filter((existing) => existing.path !== path)]);
    },

    remove(path: string) {
      write(entries.filter((entry) => entry.path !== path));
    },

    /** An item went to the Trash: forget it and everything under it. */
    removePrefix(path: string) {
      write(entries.filter((entry) => !under(path, entry.path)));
    },

    /** A Space was renamed: move it and every file inside it. */
    renamePrefix(from: string, to: string) {
      write(entries.map((entry) => (under(from, entry.path) ? { ...entry, path: to + entry.path.slice(from.length) } : entry)));
    },

    /** A Space or file moved: keep its place under the new path. */
    rename(from: string, to: string) {
      write(entries.map((entry) => (entry.path === from ? { ...entry, path: to } : entry)));
    },
  };
}

function safeLocalStorage(): RecentsStorage {
  return {
    getItem: (key) => globalThis.localStorage.getItem(key),
    setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  };
}
