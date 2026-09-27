import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AUTOSAVE_DELAY_LIMITS, SETTINGS_DEFAULTS, createSettings, type SettingsIO } from './settings.svelte';

const defaults = {
  debounceMs: 250,
  layoutEngine: 'tala',
  autosave: 'off',
  autosaveDelayMs: 1000,
  verboseLogging: false,
  arrowBinding: true,
  midpointSnap: true,
  objectSnap: false,
};

function io(over: Partial<SettingsIO> = {}): SettingsIO {
  return {
    load: vi.fn().mockResolvedValue({ ...defaults }),
    save: vi.fn().mockResolvedValue(''),
    setVerbose: vi.fn().mockResolvedValue(''),
    ...over,
  };
}

describe('settings', () => {
  it('uses defaults until loaded, then the stored values', async () => {
    const stored = io({ load: vi.fn().mockResolvedValue({ ...defaults, autosave: 'afterDelay' }) });
    const settings = createSettings(stored);
    expect(settings.autosave).toBe('off');
    await settings.load();
    expect(settings.autosave).toBe('afterDelay');
  });

  it('TestChangingAutosaveModeIsPersisted', async () => {
    const stored = io();
    const settings = createSettings(stored);
    await settings.load();
    await settings.setAutosave('onFocusChange');
    expect(settings.autosave).toBe('onFocusChange');
    expect(stored.save).toHaveBeenCalledWith({ ...defaults, autosave: 'onFocusChange' });
  });

  // Keys this frontend does not edit must survive a save untouched.
  it('keeps every other value when saving', async () => {
    const stored = io({ load: vi.fn().mockResolvedValue({ ...defaults, layoutEngine: 'elk' }) });
    const settings = createSettings(stored);
    await settings.load();
    await settings.setAutosaveDelay(2500);
    expect(stored.save).toHaveBeenCalledWith({ ...defaults, layoutEngine: 'elk', autosaveDelayMs: 2500 });
  });

  it('reports a failed save', async () => {
    const settings = createSettings(io({ save: vi.fn().mockResolvedValue('disk full') }));
    await settings.load();
    expect(await settings.setAutosave('afterDelay')).toBe('disk full');
  });

  it('treats a mode it does not know as off', async () => {
    const settings = createSettings(io({ load: vi.fn().mockResolvedValue({ ...defaults, autosave: 'sometimes' }) }));
    await settings.load();
    expect(settings.autosave).toBe('off');
  });

  it('rolls back and reports when the save fails', async () => {
    const settings = createSettings(io({ save: vi.fn().mockResolvedValue('disk full') }));
    await settings.load();
    await settings.setAutosave('afterDelay');
    expect(settings.autosave).toBe('off');
  });

  // Saving before the file was read would write the frontend's defaults over
  // every value the user had set.
  it('refuses to save before the settings have loaded', async () => {
    const stored = io({ load: vi.fn().mockRejectedValue(new Error('no backend')) });
    const settings = createSettings(stored);
    await settings.load().catch(() => {});
    expect(await settings.setAutosave('afterDelay')).not.toBe('');
    expect(stored.save).not.toHaveBeenCalled();
    expect(settings.autosave).toBe('off');
  });

  // The defaults and limits are copied from Go. Read Go's source so they
  // cannot drift apart unnoticed.
  it('mirrors the limits and defaults in internal/config', () => {
    const go = readFileSync(resolve(__dirname, '../../../internal/config/config.go'), 'utf8');
    const constant = (name: string) => Number(new RegExp(`${name}\\s*=\\s*([\\d_]+)`).exec(go)?.[1].replace(/_/g, ''));
    expect(AUTOSAVE_DELAY_LIMITS).toEqual({ min: constant('MinAutosaveDelayMS'), max: constant('MaxAutosaveDelayMS') });
    expect(go).toContain(`AutosaveDelayMS: ${SETTINGS_DEFAULTS.autosaveDelayMs},`);
    expect(go).toContain(`DebounceMS:   ${SETTINGS_DEFAULTS.debounceMs},`);
    expect(go).toContain(`ArrowBinding: ${SETTINGS_DEFAULTS.arrowBinding},`);
    expect(go).toContain(`MidpointSnap: ${SETTINGS_DEFAULTS.midpointSnap},`);
    expect(go).toContain(`ObjectSnap: ${SETTINGS_DEFAULTS.objectSnap},`);
  });

  // Go owns the verbose flag: it changes the live log level as well as the
  // saved preference, so the settings module asks it rather than saving itself.
  it('toggling verbose logging goes through the log service and reflects the result', async () => {
    const stored = io();
    const settings = createSettings(stored);
    await settings.load();
    expect(await settings.setVerboseLogging(true)).toBe('');
    expect(stored.setVerbose).toHaveBeenCalledWith(true);
    expect(stored.save).not.toHaveBeenCalled();
    expect(settings.verboseLogging).toBe(true);
  });

  it('keeps verbose logging as it was when the change fails', async () => {
    const settings = createSettings(io({ setVerbose: vi.fn().mockResolvedValue('disk full') }));
    await settings.load();
    expect(await settings.setVerboseLogging(true)).toBe('disk full');
    expect(settings.verboseLogging).toBe(false);
  });
});

// The Diagram from Code dialog opens with the engine used last:
// inserting saves it as the default, and an engine the app does not know
// reads as TALA rather than reaching the renderer.
describe('the layout engine', () => {
  it('is saved as the default when set', async () => {
    const stored = io();
    const settings = createSettings(stored);
    await settings.load();
    await settings.setLayoutEngine('dagre');
    expect(settings.layoutEngine).toBe('dagre');
    expect(stored.save).toHaveBeenCalledWith({ ...defaults, layoutEngine: 'dagre' });
  });

  it('reads an engine it does not know as TALA', async () => {
    const settings = createSettings(io({ load: vi.fn().mockResolvedValue({ ...defaults, layoutEngine: 'nomnoml' }) }));
    await settings.load();
    expect(settings.layoutEngine).toBe('tala');
  });
});

// Settings ▸ Canvas.
describe('the canvas settings', () => {
  it('attach arrows and snap to side middles by default, and save a change', async () => {
    const stored = io();
    const settings = createSettings(stored);
    await settings.load();
    expect(settings.arrowBinding).toBe(true);
    expect(settings.midpointSnap).toBe(true);
    await settings.setArrowBinding(false);
    await settings.setMidpointSnap(false);
    expect(settings.arrowBinding).toBe(false);
    expect(stored.save).toHaveBeenLastCalledWith({ ...defaults, arrowBinding: false, midpointSnap: false });
  });
});


// Snapping to objects is off until the user turns it on.
describe('snapping to objects', () => {
  it('is off by default, and saves a change', async () => {
    const stored = io();
    const settings = createSettings(stored);
    await settings.load();
    expect(settings.objectSnap).toBe(false);
    await settings.setObjectSnap(true);
    expect(settings.objectSnap).toBe(true);
    expect(stored.save).toHaveBeenLastCalledWith({ ...defaults, objectSnap: true });
  });

  it('reads a settings file without it as off', async () => {
    const older: Partial<typeof defaults> = { ...defaults };
    delete older.objectSnap;
    const settings = createSettings(io({ load: vi.fn().mockResolvedValue(older) }));
    await settings.load();
    expect(settings.objectSnap).toBe(false);
  });
});
