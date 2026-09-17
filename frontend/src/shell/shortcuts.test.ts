import { describe, expect, it } from 'vitest';
import spec from '../../../internal/app/menu/spec.json';
import { canvasScoped, formatAccelerator, keysFor, matchShortcut, reservedByMenu, shortcutGroups, type MenuSpec } from './shortcuts';

describe('formatAccelerator', () => {
  it('uses symbols on macOS, in the platform order', () => {
    expect(formatAccelerator('Shift+CmdOrCtrl+Z', 'darwin')).toBe('⇧⌘Z');
    expect(formatAccelerator('OptionOrAlt+CmdOrCtrl+I', 'darwin')).toBe('⌥⌘I');
  });

  it('shows arrow keys as arrows', () => {
    expect(formatAccelerator('Shift+CmdOrCtrl+Left', 'darwin')).toBe('⇧⌘←');
    expect(formatAccelerator('Shift+CmdOrCtrl+Up', 'windows')).toBe('Ctrl+Shift+↑');
  });

  it('spells modifiers out elsewhere', () => {
    expect(formatAccelerator('Shift+CmdOrCtrl+Z', 'windows')).toBe('Ctrl+Shift+Z');
    expect(formatAccelerator('CmdOrCtrl+=', 'linux')).toBe('Ctrl+=');
  });
});

// The no-file state shows the keys for Open and New: whatever the menu binds.
describe('keysFor', () => {
  it('formats the key the menu binds for a command, per platform', () => {
    expect(keysFor(spec as MenuSpec, 'file.open', 'darwin')).toBe('⌘O');
    expect(keysFor(spec as MenuSpec, 'file.new', 'windows')).toBe('Ctrl+N');
  });

  it('is empty for a command with no key', () => {
    expect(keysFor(spec as MenuSpec, 'no.such.command', 'darwin')).toBe('');
  });
});

describe('shortcutGroups', () => {
  const groups = shortcutGroups(spec as MenuSpec, 'darwin');
  const rows = groups.flatMap((g) => g.rows);

  it('lists every accelerator the spec binds on the platform', () => {
    expect(rows.find((r) => r.label === 'Save')?.keys).toBe('⌘S');
    expect(rows.find((r) => r.label === 'Rectangle')?.keys).toBe('R');
  });

  it('lists items only on their platforms', () => {
    const windows = shortcutGroups(spec as MenuSpec, 'windows').flatMap((g) => g.rows);
    expect(rows.filter((r) => r.label === 'Settings…')).toHaveLength(1);
    expect(windows.filter((r) => r.label === 'Settings…')).toHaveLength(1);
    expect(windows.find((r) => r.label === 'Settings…')?.keys).toBe('Ctrl+,');
  });

  it('leaves out menus with nothing to press', () => {
    expect(groups.every((g) => g.rows.length > 0)).toBe(true);
  });
});

const key = (over: Partial<KeyboardEvent>) =>
  ({ key: '', code: '', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...over }) as KeyboardEvent;

describe('matchShortcut', () => {
  const mac = matchShortcut(spec as MenuSpec, 'darwin');
  const windows = matchShortcut(spec as MenuSpec, 'windows');

  it('matches a shortcut by physical key, whatever Shift turns it into', () => {
    // Option+] reports key "‘" on a US Mac layout; the code is what the user pressed.
    expect(mac(key({ key: '‘', code: 'BracketRight', metaKey: true, altKey: true }))).toBe('canvas.bringToFront');
    expect(windows(key({ key: '=', code: 'Equal', ctrlKey: true }))).toBe('view.zoomIn');
    expect(windows(key({ key: ',', code: 'Comma', ctrlKey: true }))).toBe('file.settings');
  });

  // On macOS ⌘= and ⌘, are real menu accelerators (nativeOn). Matching them
  // here too would swallow the key before the menu saw it, or run it twice.
  it('stands down where the menu binds the shortcut natively', () => {
    expect(mac(key({ key: '=', code: 'Equal', metaKey: true }))).toBeUndefined();
    expect(mac(key({ key: ',', code: 'Comma', metaKey: true }))).toBeUndefined();
  });

  it('requires exactly the modifiers the shortcut names', () => {
    expect(windows(key({ key: '=', code: 'Equal', altKey: true }))).toBeUndefined();
    expect(mac(key({ key: '}', code: 'BracketRight', metaKey: true, shiftKey: true }))).toBeUndefined();
    expect(windows(key({ key: '=', code: 'Equal', ctrlKey: true, altKey: true }))).toBeUndefined();
  });

  // Native accelerators fire through the menu; matching them here too would
  // run the command twice.
  it('ignores native accelerators', () => {
    expect(mac(key({ key: 's', code: 'KeyS', metaKey: true }))).toBeUndefined();
  });
});

// Canvas-scoped shortcuts act only on the canvas. The source editor keeps the
// same keys: ⌘] indents there, ⌘D selects the next match.
describe('canvas-scoped shortcuts', () => {
  it('leaves their keys to the source editor', () => {
    const mac = reservedByMenu(spec as MenuSpec, 'darwin');
    expect(mac({ key: 'Mod-]' })).toBe(false);
    expect(mac({ key: 'Mod-[' })).toBe(false);
    expect(mac({ key: 'Mod-d' })).toBe(false);
  });

  it('are listed, so the page can ignore them away from the canvas', () => {
    const scoped = canvasScoped(spec as MenuSpec);
    expect(scoped.has('canvas.bringForward')).toBe(true);
    expect(scoped.has('canvas.duplicate')).toBe(true);
    expect(scoped.has('canvas.flipHorizontal')).toBe(true);
    expect(scoped.has('file.save')).toBe(false);
  });

  it('still match their keys', () => {
    const match = matchShortcut(spec as MenuSpec, 'darwin');
    const press = (code: string, mods: Partial<KeyboardEvent>) =>
      match(key({ code, key: code.replace(/^Key/, '').toLowerCase(), ...mods }));
    expect(press('BracketRight', { metaKey: true })).toBe('canvas.bringForward');
    expect(press('BracketRight', { metaKey: true, altKey: true })).toBe('canvas.bringToFront');
    expect(press('KeyH', { shiftKey: true })).toBe('canvas.flipHorizontal');
    expect(press('KeyD', { metaKey: true })).toBe('canvas.duplicate');
    expect(match(key({ key: 'ArrowLeft', code: 'ArrowLeft', metaKey: true, shiftKey: true }))).toBe('canvas.alignLeft');
    expect(press('KeyH', { altKey: true })).toBe('canvas.distributeHorizontal');
  });
});

describe('reservedByMenu', () => {
  const mac = reservedByMenu(spec as MenuSpec, 'darwin');
  const linux = reservedByMenu(spec as MenuSpec, 'linux');

  // The source editor must not also answer a key the menu owns, or one press
  // acts twice on a webview that delivers both.
  it('claims editor bindings the menu owns', () => {
    expect(mac({ key: 'Mod-z' })).toBe(true);
    expect(mac({ key: 'Mod-Shift-z' })).toBe(true);
    expect(mac({ key: 'Shift-Mod-z' })).toBe(true);
    expect(mac({ key: 'Mod-a' })).toBe(true);
    expect(mac({ key: 'Mod-/' })).toBe(true);
    expect(linux({ key: 'Mod-y', mac: 'Mod-Shift-z' })).toBe(false);
    expect(mac({ key: 'Mod-y', mac: 'Mod-Shift-z' })).toBe(true);
  });

  it('leaves the editor its own keys', () => {
    expect(mac({ key: 'Enter' })).toBe(false);
    expect(mac({ key: 'Mod-Enter' })).toBe(false);
    expect(mac({ key: 'Alt-ArrowUp' })).toBe(false);
  });
});
