/**
 * Which regions of the shell are visible.
 *
 * `Document | Both | Canvas` is the view mode. The file tree and the AI pane
 * are sidebars rather than modes: either can be open in any mode, which is why
 * they are separate flags and not more entries in the union.
 *
 * All of it is per-viewer convenience, stored in localStorage behind guards.
 */
export const VIEW_STATE_KEY = 'bava.view';

export type ViewMode = 'document' | 'both' | 'canvas';

export type ViewStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type Persisted = {
  mode: ViewMode;
  showsFiles: boolean;
  showsAI: boolean;
};

const DEFAULTS: Persisted = {
  mode: 'both',
  showsFiles: true,
  // Collapsed until a provider is configured: an empty pane taking a quarter
  // of the window teaches the user nothing.
  showsAI: false,
};

function isMode(value: unknown): value is ViewMode {
  return value === 'document' || value === 'both' || value === 'canvas';
}

function parse(raw: string | null): Persisted {
  if (!raw) return DEFAULTS;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return DEFAULTS;
    const c = value as Record<string, unknown>;
    return {
      mode: isMode(c.mode) ? c.mode : DEFAULTS.mode,
      showsFiles: typeof c.showsFiles === 'boolean' ? c.showsFiles : DEFAULTS.showsFiles,
      showsAI: typeof c.showsAI === 'boolean' ? c.showsAI : DEFAULTS.showsAI,
    };
  } catch {
    return DEFAULTS;
  }
}

export function createViewState(options: { storage?: ViewStorage } = {}) {
  const storage = options.storage ?? safeLocalStorage();

  let state = $state.raw<Persisted>(read());

  function read(): Persisted {
    try {
      return parse(storage.getItem(VIEW_STATE_KEY));
    } catch {
      return DEFAULTS;
    }
  }

  function update(next: Persisted) {
    state = next;
    try {
      storage.setItem(VIEW_STATE_KEY, JSON.stringify(next));
    } catch {
      // The layout holds for this session; only persistence is lost.
    }
  }

  return {
    get mode() {
      return state.mode;
    },
    get showsDocument() {
      return state.mode !== 'canvas';
    },
    get showsCanvas() {
      return state.mode !== 'document';
    },
    get showsFiles() {
      return state.showsFiles;
    },
    get showsAI() {
      return state.showsAI;
    },

    setMode(mode: ViewMode) {
      update({ ...state, mode });
    },
    toggleFiles() {
      update({ ...state, showsFiles: !state.showsFiles });
    },
    toggleAI() {
      update({ ...state, showsAI: !state.showsAI });
    },
  };
}

export type ViewState = ReturnType<typeof createViewState>;

function safeLocalStorage(): ViewStorage {
  return {
    getItem: (key) => globalThis.localStorage.getItem(key),
    setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  };
}
