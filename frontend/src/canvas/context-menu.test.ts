import { describe, expect, it } from 'vitest';
import { COMMAND_IDS } from '../shell/commands';
import { atPoint, contextMenuFor, contextSelection, overflowMenu, parseOverflowId, type MenuNode } from './context-menu';

const ids = (nodes: MenuNode[]): string[] =>
  nodes.flatMap((n) => (n.kind === 'separator' ? ['—'] : n.kind === 'submenu' ? [`${n.id}▸`, ...ids(n.items).map((i) => `  ${i}`)] : [n.id]));

const base = { units: 1, canGroup: false, canUngroup: false, canPaste: true, canPasteStyles: true, hasLocked: false };

describe('the right-click menu', () => {
  it('lists the groups for one element, with no align, in order', () => {
    expect(ids(contextMenuFor(base))).toEqual([
      'edit.cut', 'edit.copy', 'edit.paste',
      '—',
      'canvas.copyAs▸', '  canvas.copyPng', '  canvas.copySvg',
      'canvas.exportSelection',
      '—',
      'canvas.copyStyles', 'canvas.pasteStyles',
      '—',
      'canvas.arrange▸',
      '  canvas.bringToFront', '  canvas.bringForward', '  canvas.sendBackward', '  canvas.sendToBack',
      'canvas.flip▸', '  canvas.flipHorizontal', '  canvas.flipVertical',
      '—',
      'canvas.duplicate', 'canvas.lock',
      '—',
      'edit.delete',
    ]);
  });

  it('adds align for two units, and distribute from three', () => {
    const two = ids(contextMenuFor({ ...base, units: 2 }));
    expect(two).toContain('canvas.align▸');
    expect(two).toContain('  canvas.alignLeft');
    expect(two).not.toContain('  canvas.distributeHorizontal');
    const three = ids(contextMenuFor({ ...base, units: 3 }));
    expect(three).toContain('  canvas.distributeHorizontal');
  });

  it('offers group and ungroup only when they apply', () => {
    expect(ids(contextMenuFor({ ...base, units: 2, canGroup: true }))).toContain('canvas.group');
    expect(ids(contextMenuFor({ ...base, canUngroup: true }))).toContain('canvas.ungroup');
    expect(ids(contextMenuFor(base))).not.toContain('canvas.group');
  });

  it('on empty canvas offers paste and select all', () => {
    expect(ids(contextMenuFor({ ...base, units: 0 }))).toEqual(['edit.paste', 'edit.selectAll']);
  });

  // No dead items. Until Milestone 6.4 that meant listing no export entry at
  // all; now the rule is the enduring one: everything offered is a command the
  // app actually handles.
  it('offers only commands the app handles', () => {
    const offered = ids(contextMenuFor({ ...base, units: 3, canGroup: true, canUngroup: true, hasLocked: true }))
      .map((id) => id.replace(/^\s+/, '').replace(/▸$/, ''))
      .filter((id) => id !== '—');
    const known = new Set<string>(COMMAND_IDS);
    // A submenu is a container, not a command, so it is not in the list.
    const containers = new Set(['canvas.arrange', 'canvas.align', 'canvas.flip', 'canvas.copyAs']);
    expect(offered.filter((id) => !known.has(id) && !containers.has(id))).toEqual([]);
  });

  it('offers Lock on a selection, and Unlock All only when something is locked', () => {
    expect(ids(contextMenuFor(base))).toContain('canvas.lock');
    expect(ids(contextMenuFor(base))).not.toContain('canvas.unlockAll');
    expect(ids(contextMenuFor({ ...base, units: 0 }))).not.toContain('canvas.lock');
    expect(ids(contextMenuFor({ ...base, units: 0, hasLocked: true }))).toContain('canvas.unlockAll');
    expect(ids(contextMenuFor({ ...base, hasLocked: true }))).toContain('canvas.unlockAll');
  });

  it('labels items and shows their keys', () => {
    const cut = contextMenuFor(base)[0];
    expect(cut).toMatchObject({ kind: 'item', label: 'Cut' });
    expect(cut.kind === 'item' && cut.keys).toBeTruthy();
    const nodes = contextMenuFor(base);
    const arrange = nodes.find((n) => n.kind === 'submenu' && n.id === 'canvas.arrange');
    expect(arrange).toMatchObject({ label: 'Arrange' });
  });
});

// The menu stays mounted and opens at a new point each time. Ark must read the
// point when it positions the menu, not when the menu mounted: read at mount,
// it had none and placed the menu off the bottom of the window.
describe('placing the menu at a point', () => {
  it('reads the current point each time it is asked', () => {
    let point: { x: number; y: number } | null = null;
    const positioning = atPoint(() => point);
    expect(positioning.getAnchorRect()).toBeNull();
    point = { x: 120, y: 90 };
    expect(positioning.getAnchorRect()).toEqual({ x: 120, y: 90, width: 0, height: 0 });
    point = { x: 5, y: 6 };
    expect(positioning.getAnchorRect()).toMatchObject({ x: 5, y: 6 });
  });
});

// No dead items: nothing to paste means no Paste.
describe('paste items', () => {
  it('are left out when there is nothing to paste', () => {
    const none = ids(contextMenuFor({ ...base, canPaste: false, canPasteStyles: false }));
    expect(none).not.toContain('edit.paste');
    expect(none).not.toContain('canvas.pasteStyles');
    expect(none).toContain('canvas.copyStyles');
    expect(ids(contextMenuFor({ ...base, units: 0, canPaste: false }))).toEqual(['edit.selectAll']);
  });
});

describe('what a right-click acts on', () => {
  const scene = {
    elements: [
      { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
      { id: 'b', type: 'rect', x: 20, y: 0, w: 10, h: 10, z: 2 },
      { id: 'g', type: 'group', x: 0, y: 0, w: 30, h: 10, z: 3, children: ['a', 'b'] },
      { id: 'c', type: 'rect', x: 50, y: 0, w: 10, h: 10, z: 4 },
    ],
  } as never;

  it('is nothing on empty canvas, whatever was selected', () => {
    expect(contextSelection(scene, ['c'], undefined)).toEqual([]);
  });

  it('keeps the selection when the hit is in it, or inside a selected group', () => {
    expect(contextSelection(scene, ['c', 'a'], 'a')).toEqual(['c', 'a']);
    expect(contextSelection(scene, ['g'], 'a')).toEqual(['g']);
  });

  it('selects the outermost group of an unselected hit, as a left click does', () => {
    expect(contextSelection(scene, ['c'], 'b')).toEqual(['g']);
    expect(contextSelection(scene, [], 'c')).toEqual(['c']);
  });
});

// A control pushed out of the toolbar row has to stay reachable: More is
// where it goes (canvas-toolbar.md, "the controls that do not fit move into
// the More menu"). Without this, a narrow window hid them entirely.
describe('controls that overflow the toolbar row', () => {
  it('offers each one as a submenu of its choices', () => {
    const nodes = overflowMenu([
      { id: 'edges', group: 'stroke', kind: 'options' },
      { id: 'opacity', group: 'stroke', kind: 'slider' },
      { id: 'fill', group: 'colour', kind: 'colour' },
    ]);
    expect(ids(nodes)).toEqual([
      '—',
      'property:edges▸', '  property:edges:sharp', '  property:edges:round',
      'property:opacity▸', '  property:opacity:100', '  property:opacity:75', '  property:opacity:50', '  property:opacity:25',
      'style:fill▸', '  style:fill:', '  style:fill:gray', '  style:fill:blue', '  style:fill:green',
      '  style:fill:yellow', '  style:fill:orange', '  style:fill:red', '  style:fill:purple', '  style:fill:pink',
    ]);
  });

  it('is nothing at all when everything fits', () => {
    expect(overflowMenu([])).toEqual([]);
  });

  it('names each choice as the toolbar names it', () => {
    const [, edges] = overflowMenu([{ id: 'edges', group: 'stroke', kind: 'options' }]);
    expect(edges.kind === 'submenu' && edges.label).toBe('Edges');
    expect(edges.kind === 'submenu' && edges.items.map((i) => i.kind === 'item' && i.label)).toEqual(['Sharp', 'Round']);
  });
});

describe('what an overflow menu id means', () => {
  it('reads a property back as the typed value the option carries', () => {
    expect(parseOverflowId('property:strokeWidth:4')).toEqual({ kind: 'property', key: 'strokeWidth', value: 4 });
    expect(parseOverflowId('property:edges:round')).toEqual({ kind: 'property', key: 'edges', value: 'round' });
    expect(parseOverflowId('property:opacity:50')).toEqual({ kind: 'property', key: 'opacity', value: 50 });
  });

  it('reads a colour back, with the default as null', () => {
    expect(parseOverflowId('style:fill:blue')).toEqual({ kind: 'style', key: 'fill', swatch: 'blue' });
    expect(parseOverflowId('style:fill:')).toEqual({ kind: 'style', key: 'fill', swatch: null });
  });

  it('is null for a command id, so a command still dispatches', () => {
    expect(parseOverflowId('canvas.duplicate')).toBeNull();
    expect(parseOverflowId('property:edges:oblong')).toBeNull();
  });
});
