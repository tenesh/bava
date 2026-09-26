import { describe, expect, it } from 'vitest';
import { freeEndAt, insertTextAtEnd } from './arrow-text';
import { createHistory } from './history';
import type { SceneElement } from './scene';

// 06.16 B29: with the Text tool, a click by a free arrow end starts a text
// there that the end attaches to, the arrow staying where it is
// (Excalidraw's `element/src/arrowEndpointText.ts`).
const arrow = (over: Record<string, unknown> = {}) =>
  ({ id: 'r', type: 'arrow', x: 0, y: 0, w: 100, h: 0, z: 1, points: [0, 0, 100, 0], ...over }) as never as SceneElement;
const measure = () => ({ width: 40, height: 20 });

describe('a free arrow end under the Text tool', () => {
  it('is found near the tip, the end preferred, a bound one skipped', () => {
    expect(freeEndAt({ elements: [arrow()] }, { x: 103, y: 2 }, 11)).toMatchObject({ side: 'end' });
    expect(freeEndAt({ elements: [arrow()] }, { x: -3, y: 1 }, 11)).toMatchObject({ side: 'start' });
    expect(freeEndAt({ elements: [arrow({ endBinding: 'x' })] }, { x: 103, y: 2 }, 11)).toBeNull();
    expect(freeEndAt({ elements: [arrow()] }, { x: 50, y: 30 }, 11)).toBeNull();
  });

  it('gets a text past its tip, attached by the facing side, in one step', () => {
    const history = createHistory({ elements: [arrow()] });
    const id = insertTextAtEnd(history, { arrow: 'r', side: 'end' }, 'label', measure);
    const text = history.current.elements.find((e) => e.id === id)!;
    // Left-aligned, its left middle a gap (6) past the tip at (100, 0).
    expect(text).toMatchObject({ x: 106, y: -10, w: 40, h: 20, align: 'left' });
    const r = history.current.elements.find((e) => e.id === 'r') as unknown as { x: number; points: number[] };
    expect(history.current.elements.find((e) => e.id === 'r')).toMatchObject({ endBinding: id, endAnchor: [0, 0.5] });
    expect(r.x + r.points[2]).toBe(100);
    history.undo();
    expect(history.current.elements).toHaveLength(1);
  });
});

describe('a text at a diagonal arrow end (review of 06.16)', () => {
  it('leaves the arrow where it was', () => {
    const history = createHistory({ elements: [arrow({ w: 100, h: 100, points: [0, 0, 100, 100] })] });
    insertTextAtEnd(history, { arrow: 'r', side: 'end' }, 'label', measure);
    const r = history.current.elements.find((e) => e.id === 'r') as unknown as { x: number; y: number; points: number[] };
    expect(r.x + r.points[2]).toBeCloseTo(100, 5);
    expect(r.y + r.points[3]).toBeCloseTo(100, 5);
  });
});
