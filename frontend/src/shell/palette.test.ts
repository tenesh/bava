import { describe, expect, it } from 'vitest';
import spec from '../../../internal/app/menu/spec.json';
import type { MenuSpec } from './shortcuts';
import { createRecent, matchCommands, paletteCommands, paletteGroups, type MenuState } from './palette';

const everything: MenuState = { hasSelection: true, canPasteStyles: true, hasLocked: true, hasDocument: true, showsCanvas: true, hasSpace: true };
const commands = (state: MenuState = everything) => paletteCommands(spec as MenuSpec, 'darwin', state);
const byId = (id: string, list = commands()) => list.find((command) => command.id === id);

describe('the commands the palette offers', () => {
  it('names each by its label, its menu path and its keys', () => {
    expect(byId('view.zoomToFit')).toMatchObject({ label: 'Zoom to Fit', path: 'View', keys: '⇧1' });
    expect(byId('file.exportPage')).toMatchObject({ label: 'Page', path: 'File ▸ Export', keys: '' });
    expect(byId('tool.rect')).toMatchObject({ label: 'Rectangle', keys: 'R' });
  });

  it('offers commands, checkboxes and choices, never a role, a submenu or the recent files', () => {
    expect(byId('view.files')).toBeDefined();
    expect(byId('view.document')).toBeDefined();
    expect(byId('file.exportMenu')).toBeUndefined();
    expect(byId('file.openRecent')).toBeUndefined();
    expect(commands().every((command) => command.id && command.label)).toBe(true);
  });

  it('leaves out what cannot run now, as the menu disables it', () => {
    const nothing = commands({ ...everything, hasSelection: false });
    expect(byId('view.zoomToSelection', nothing)).toBeUndefined();
    expect(byId('canvas.group', nothing)).toBeUndefined();
    expect(byId('view.zoomToFit', nothing)).toBeDefined();
    expect(byId('insert.diagram', commands({ ...everything, showsCanvas: false }))).toBeUndefined();
    expect(byId('insert.picture', commands({ ...everything, showsCanvas: false }))).toBeUndefined();
    expect(byId('insert.picture')).toBeDefined();
  });

  it('never offers itself', () => {
    expect(byId('view.commandPalette')).toBeUndefined();
  });

  it('keeps the menus in their order', () => {
    const menus = [...new Set(commands().map((command) => command.menu))];
    expect(menus.slice(0, 3)).toEqual(['Bava', 'File', 'Edit']);
  });

  it('takes the menu as each platform shows it', () => {
    const windows = paletteCommands(spec as MenuSpec, 'windows', everything);
    expect(windows.find((command) => command.id === 'view.zoomToFit')?.keys).toBe('Shift+1');
    expect(windows.some((command) => command.menu === 'Bava')).toBe(false);
  });
});

describe('finding a command by what is typed', () => {
  it('finds every word, in any order, in the label or the path', () => {
    expect(matchCommands(commands(), 'fit zoom').map((command) => command.id)).toEqual(['view.zoomToFit']);
    expect(matchCommands(commands(), 'export page').map((command) => command.id)).toContain('file.exportPage');
  });

  it('puts what the label holds before what only the path holds', () => {
    const found = matchCommands(commands(), 'export').map((command) => command.id);
    expect(found.indexOf('canvas.exportSelection')).toBeLessThan(found.indexOf('file.exportPage'));
  });

  it('ignores case and space round the words, and finds nothing for nothing that matches', () => {
    expect(matchCommands(commands(), '  ZOOM   in ').map((command) => command.id)).toEqual(['view.zoomIn']);
    expect(matchCommands(commands(), 'xyzzy')).toEqual([]);
  });
});

describe('the recent commands', () => {
  it('keeps the last five, newest first, each once', () => {
    const recent = createRecent();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'c']) recent.add(id);
    expect(recent.ids).toEqual(['c', 'f', 'e', 'd', 'b']);
  });
});

describe('the palette grouped', () => {
  it('lists the recent first, then every command under its menu, before anything is typed', () => {
    const groups = paletteGroups(commands(), '', ['view.zoomToFit', 'gone.away'], 'Recent');
    expect(groups[0]).toMatchObject({ title: 'Recent' });
    expect(groups[0].commands.map((command) => command.id)).toEqual(['view.zoomToFit']);
    expect(groups.slice(1).map((group) => group.title).slice(0, 3)).toEqual(['Bava', 'File', 'Edit']);
  });

  it('drops a recent command that cannot run now', () => {
    const groups = paletteGroups(commands({ ...everything, hasSelection: false }), '', ['canvas.group', 'view.zoomToFit'], 'Recent');
    expect(groups[0].commands.map((command) => command.id)).toEqual(['view.zoomToFit']);
  });

  it('has no Recent group while nothing has been run', () => {
    expect(paletteGroups(commands(), '', [], 'Recent')[0].title).toBe('Bava');
  });

  it('lists only what matches once something is typed, in one group', () => {
    const groups = paletteGroups(commands(), 'zoom fit', ['view.zoomIn'], 'Recent');
    expect(groups).toHaveLength(1);
    expect(groups[0].commands.map((command) => command.id)).toEqual(['view.zoomToFit']);
  });
});
