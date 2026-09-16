/**
 * User preferences, as the frontend sees them.
 *
 * Go owns the file and its validation (`internal/config`); this module holds
 * the loaded values and writes back the whole object, so keys it does not edit
 * survive a save.
 */
import { FileService } from '../../bindings/github.com/tenesh/bava/internal/app';
import type { Settings } from '../../bindings/github.com/tenesh/bava/internal/config/models';
import type { AutosaveMode } from '../files/autosave.svelte';

export type SettingsIO = {
  load(): Promise<Settings>;
  /** Resolves with an error message, or '' on success. */
  save(settings: Settings): Promise<string>;
};

const overIPC: SettingsIO = {
  load: () => FileService.Settings(),
  save: (settings) => FileService.SaveSettings(settings),
};

export { AUTOSAVE_DELAY_LIMITS } from './limits';

// Mirrors config.Defaults; a test reads config.go to hold them equal.
export const SETTINGS_DEFAULTS: Settings = {
  debounceMs: 250,
  layoutEngine: 'tala',
  autosave: 'off',
  autosaveDelayMs: 1000,
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

    async load(): Promise<void> {
      values = await io.load();
      loaded = true;
    },

    setAutosave: (mode: AutosaveMode) => update({ autosave: mode }),
    setAutosaveDelay: (ms: number) => update({ autosaveDelayMs: ms }),
  };
}

export type SettingsState = ReturnType<typeof createSettings>;
