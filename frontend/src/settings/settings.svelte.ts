/**
 * User preferences, as the frontend sees them.
 *
 * Go owns the file and its validation (`internal/config`); this module holds
 * the loaded values and writes back the whole object, so keys it does not edit
 * survive a save.
 */
import { FileService, LogService } from '../../bindings/github.com/tenesh/bava/internal/app';
import type { Settings } from '../../bindings/github.com/tenesh/bava/internal/config/models';
import type { AutosaveMode } from '../files/autosave.svelte';
import { isLayoutEngine, type LayoutEngine } from './layout-engine';

export type SettingsIO = {
  load(): Promise<Settings>;
  /** Resolves with an error message, or '' on success. */
  save(settings: Settings): Promise<string>;
  /** Switches the live log level and saves the preference, in Go. */
  setVerbose(on: boolean): Promise<string>;
};

const overIPC: SettingsIO = {
  load: () => FileService.Settings(),
  save: (settings) => FileService.SaveSettings(settings),
  setVerbose: (on) => LogService.SetVerbose(on),
};

export { AUTOSAVE_DELAY_LIMITS } from './limits';

// Mirrors config.Defaults; a test reads config.go to hold them equal.
export const SETTINGS_DEFAULTS: Settings = {
  debounceMs: 250,
  layoutEngine: 'tala',
  autosave: 'off',
  autosaveDelayMs: 1000,
  verboseLogging: false,
  arrowBinding: true,
  midpointSnap: true,
  objectSnap: false,
};

function isMode(value: string): value is AutosaveMode {
  return value === 'off' || value === 'afterDelay' || value === 'onFocusChange';
}

export function createSettings(io: SettingsIO = overIPC) {
  let values = $state.raw<Settings>(SETTINGS_DEFAULTS);
  let loaded = false;

  /** Resolves with an error message, or '' once saved. */
  async function update(changes: Partial<Settings>): Promise<string> {
    if (!loaded) return 'settings have not loaded';
    const previous = values;
    values = { ...values, ...changes };
    const error = await io.save(values);
    // The screen must not show a preference the file does not hold.
    if (error) values = previous;
    return error;
  }

  return {
    get autosave(): AutosaveMode {
      return isMode(values.autosave) ? values.autosave : 'off';
    },
    get autosaveDelayMs(): number {
      return values.autosaveDelayMs;
    },
    get verboseLogging(): boolean {
      return values.verboseLogging;
    },
    /** Whether arrow ends attach to shapes (Cmd/Ctrl turns it over for a drag). */
    get arrowBinding(): boolean {
      return values.arrowBinding;
    },
    /** Whether an arrow end snaps to a side's middle. */
    get midpointSnap(): boolean {
      return values.midpointSnap;
    },
    /** Whether a moved, resized or drawn shape snaps to other elements (Cmd/Ctrl turns it over for a drag). */
    get objectSnap(): boolean {
      return values.objectSnap === true;
    },
    /** The engine the Diagram from Code dialog opens with; one it does not know reads as TALA. */
    get layoutEngine(): LayoutEngine {
      return isLayoutEngine(values.layoutEngine) ? values.layoutEngine : 'tala';
    },

    async load(): Promise<void> {
      values = await io.load();
      loaded = true;
    },

    setAutosave: (mode: AutosaveMode) => update({ autosave: mode }),
    setAutosaveDelay: (ms: number) => update({ autosaveDelayMs: ms }),
    setLayoutEngine: (engine: LayoutEngine) => update({ layoutEngine: engine }),
    setArrowBinding: (on: boolean) => update({ arrowBinding: on }),
    setMidpointSnap: (on: boolean) => update({ midpointSnap: on }),
    setObjectSnap: (on: boolean) => update({ objectSnap: on }),

    /**
     * Go owns this one: it changes the live log level too. Saving it here as
     * well would race Go's write of the same file.
     */
    async setVerboseLogging(on: boolean): Promise<string> {
      const error = await io.setVerbose(on);
      if (!error) values = { ...values, verboseLogging: on };
      return error;
    },
  };
}

export type SettingsState = ReturnType<typeof createSettings>;
