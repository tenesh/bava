import { describe, expect, it } from 'vitest';
import { atPoint, contextMenuFor, contextSelection, type MenuNode } from './context-menu';

const ids = (nodes: MenuNode[]): string[] =>
  nodes.flatMap((n) => (n.kind === 'separator' ? ['—'] : n.kind === 'submenu' ? [`${n.id}▸`, ...ids(n.items).map((i) => `  ${i}`)] : [n.id]));

const base = { units: 1, canGroup: false, canUngroup: false, canPaste: true, canPasteStyles: true };

describe('the right-click menu', () => {
  it('lists the groups for one element, with no align, in order', () => {
    expect(ids(contextMenuFor(base))).toEqual([
      'edit.cut', 'edit.copy', 'edit.paste',
      '—',
      'canvas.copyStyles', 'canvas.pasteStyles',
      '—',
      'canvas.arrange▸',
      '  canvas.bringToFront', '  canvas.bringForward', '  canvas.sendBackward', '  canvas.sendToBack',
      'canvas.flip▸', '  canvas.flipHorizontal', '  canvas.flipVertical',
      '—',
      'canvas.duplicate',
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

  // No dead items: lock, copy as PNG/SVG and export arrive with 06.3 and 6.4.
  it('has no item that does not work yet', () => {
    const all = ids(contextMenuFor({ ...base, units: 3, canGroup: true, canUngroup: true })).join(' ');
    expect(all).not.toMatch(/lock|png|svg|export/i);
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
