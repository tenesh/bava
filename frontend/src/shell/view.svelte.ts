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
  // The Files section folded under its header, the tree hidden.
  filesFolded: boolean;
  // The Media section under Files: folded, and its share of the pane (%).
  mediaFolded: boolean;
  mediaShare: number;
};

/**
 * The Media section's share of the side pane, in percent: where it starts,
 * and never so small or large as to hide it or Files (whose least is `files`).
 */
export const MEDIA_SHARE = { start: 35, min: 10, max: 80, files: 15 } as const;
const clampShare = (share: number) => Math.min(MEDIA_SHARE.max, Math.max(MEDIA_SHARE.min, share));

const DEFAULTS: Persisted = {
  mode: 'both',
  showsFiles: true,
  // Collapsed until a provider is configured: an empty pane taking a quarter
  // of the window teaches the user nothing.
  showsAI: false,
  filesFolded: false,
  mediaFolded: false,
  mediaShare: MEDIA_SHARE.start,
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
      filesFolded: typeof c.filesFolded === 'boolean' ? c.filesFolded : DEFAULTS.filesFolded,
      mediaFolded: typeof c.mediaFolded === 'boolean' ? c.mediaFolded : DEFAULTS.mediaFolded,
      mediaShare: typeof c.mediaShare === 'number' && c.mediaShare >= MEDIA_SHARE.min && c.mediaShare <= MEDIA_SHARE.max ? c.mediaShare : DEFAULTS.mediaShare,
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
    get filesFolded() {
      return state.filesFolded;
    },
    get mediaFolded() {
      return state.mediaFolded;
    },
    get mediaShare() {
      return state.mediaShare;
    },

    setMode(mode: ViewMode) {
      update({ ...state, mode });
    },
    toggleFiles() {
      update({ ...state, showsFiles: !state.showsFiles });
    },
    toggleFilesFolded() {
      update({ ...state, filesFolded: !state.filesFolded });
    },
    toggleMediaFolded() {
      update({ ...state, mediaFolded: !state.mediaFolded });
    },
    setMediaShare(share: number) {
      update({ ...state, mediaShare: clampShare(share) });
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
