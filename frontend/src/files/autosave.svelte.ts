/**
 * Autosave: writing an open document without being asked.
 *
 * Modes follow VS Code's `files.autoSave`. It is off by default, and it never
 * writes an untitled document: that would mean a save dialog nobody asked
 * for, or a path made up for them.
 *
 * A conflict — another program wrote the file — pauses autosave rather than
 * prompting. A dialog appearing mid-sentence because a background save found
 * a conflict is worse than no autosave. The status bar says so, and the next
 * save the user makes by hand decides the conflict and resumes it.
 */
export type AutosaveMode = 'off' | 'afterDelay' | 'onFocusChange';

export type AutosaveOptions = {
  settings(): { mode: AutosaveMode; delayMs: number };
  document: { readonly path: string | null; readonly dirty: boolean };
  /** Saves in place without prompting. A conflict is reported, not resolved. */
  save(): Promise<{ conflict: boolean; saved: boolean }>;
};

export function createAutosave(options: AutosaveOptions) {
  const { settings, document: doc, save } = options;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let pauseReason = $state.raw<'conflict' | 'error' | null>(null);
  let saving: Promise<void> | null = null;
  // A save was asked for while one was already writing.
  let again = false;

  function cancel() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }

  function eligible(): boolean {
    return pauseReason === null && doc.path !== null && doc.dirty;
  }

  async function run(): Promise<void> {
    if (saving) {
      again = true;
      return saving;
    }
    if (!eligible()) return;
    saving = (async () => {
      try {
        const outcome = await save();
        if (outcome.conflict) pauseReason = 'conflict';
      } catch {
        // Nothing awaits a timer. Pause and say so, rather than retrying into
        // the same failure on every keystroke.
        pauseReason = 'error';
      } finally {
        saving = null;
      }
      if (again) {
        again = false;
        await run();
      }
    })();
    return saving;
  }

  return {
    get paused(): boolean {
      return pauseReason !== null;
    },

    /** Why autosave stopped: another program wrote the file, or a save failed. */
    get pauseReason(): 'conflict' | 'error' | null {
      return pauseReason;
    },

    /** Call after every edit to the document. */
    changed(): void {
      if (settings().mode !== 'afterDelay' || !eligible()) return;
      cancel();
      timer = setTimeout(() => {
        timer = undefined;
        void run();
      }, settings().delayMs);
    },

    /** Call when the window loses focus. */
    focusLost(): Promise<void> {
      if (settings().mode !== 'onFocusChange') return Promise.resolve();
      return run();
    },

    /** After the user settles a conflict, or opens another document. */
    resume(): void {
      pauseReason = null;
    },

    destroy(): void {
      cancel();
    },
  };
}

export type Autosave = ReturnType<typeof createAutosave>;
