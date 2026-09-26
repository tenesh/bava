import { describe, expect, it } from 'vitest';
import { cursorFor, ROTATE_CURSOR } from './cursor';

// 06.14 S10, S11: the canvas cursor, as Excalidraw's (`App.tsx:8322-8555`).
describe('the canvas cursor', () => {
  const select = { tool: 'select' as const };

  it('is a pointer over a point, a middle, a segment or an anchor', () => {
    for (const kind of ['point', 'middle', 'segment', 'focus'] as const) {
      expect(cursorFor({ ...select, over: { kind } })).toBe('pointer');
    }
  });

  it('is a resize cursor on a box handle, turned with the box', () => {
    expect(cursorFor({ ...select, over: { kind: 'resize', handle: 'top', angle: 0 } })).toBe('ns-resize');
    expect(cursorFor({ ...select, over: { kind: 'resize', handle: 'top-right', angle: 0 } })).toBe('nesw-resize');
    expect(cursorFor({ ...select, over: { kind: 'resize', handle: 'right', angle: 0 } })).toBe('ew-resize');
    expect(cursorFor({ ...select, over: { kind: 'resize', handle: 'bottom-right', angle: 0 } })).toBe('nwse-resize');
    expect(cursorFor({ ...select, over: { kind: 'resize', handle: 'top', angle: 90 } })).toBe('ew-resize');
    expect(cursorFor({ ...select, over: { kind: 'resize', handle: 'top', angle: 40 } })).toBe('nesw-resize');
  });

  it('is the rotate cursor on the rotate handle', () => {
    expect(cursorFor({ ...select, over: { kind: 'rotate' } })).toBe(ROTATE_CURSOR);
  });

  it('is move over what a drag would move, and nothing over what it would not', () => {
    expect(cursorFor({ ...select, over: { kind: 'element', movable: true } })).toBe('move');
    expect(cursorFor({ ...select, over: { kind: 'element', movable: false } })).toBe('default');
  });

  it('is grab over a label, grabbing while it is dragged', () => {
    expect(cursorFor({ ...select, over: { kind: 'label' } })).toBe('grab');
    expect(cursorFor({ ...select, over: { kind: 'label' }, dragging: 'label' })).toBe('grabbing');
  });

  it('is grab to pan, grabbing while panning', () => {
    expect(cursorFor({ ...select, panning: 'ready' })).toBe('grab');
    expect(cursorFor({ tool: 'rect', panning: 'moving' })).toBe('grabbing');
  });

  it('is a crosshair for drawing tools, and text for Text', () => {
    for (const tool of ['rect', 'ellipse', 'diamond', 'arrow', 'line', 'pen', 'frame', 'code', 'eraser'] as const) {
      expect(cursorFor({ tool })).toBe('crosshair');
    }
    expect(cursorFor({ tool: 'text' })).toBe('text');
  });

  it('is a pointer in the confirm zone while drawing by clicks', () => {
    expect(cursorFor({ tool: 'line', over: { kind: 'confirm' } })).toBe('pointer');
    expect(cursorFor({ tool: 'line' })).toBe('crosshair');
  });

  it('is the default over nothing', () => {
    expect(cursorFor(select)).toBe('default');
  });
});
