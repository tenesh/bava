import { describe, expect, it } from 'vitest';
import { findOnCanvas } from './find';
import type { SceneElement } from './scene';

const el = (id: string, type: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
  ({ id, type, x, y, w: 50, h: 20, z: 0, ...extra }) as unknown as SceneElement;

describe('findOnCanvas', () => {
  it('finds labels, text, code and frame names, capitals ignored', () => {
    const elements = [
      el('shape', 'rect', 0, 0, { label: 'Launch day' }),
      el('note', 'text', 0, 100, { text: 'after the LAUNCH' }),
      el('code', 'code', 0, 200, { code: 'launch()' }),
      el('frame', 'frame', 0, 300, { label: 'Relaunch' }),
      el('arrow', 'arrow', 0, 400, { label: 'launches' }),
      el('other', 'rect', 0, 500, { label: 'Nothing' }),
    ];
    expect(findOnCanvas(elements, 'launch')).toEqual(['shape', 'note', 'code', 'frame', 'arrow']);
  });

  it('never finds lines or strokes', () => {
    expect(findOnCanvas([el('l', 'line', 0, 0, { label: 'launch' }), el('s', 'stroke', 0, 0, { label: 'launch' })], 'launch')).toEqual([]);
  });

  // Reading order: top to bottom, then left to right, whatever the drawing order.
  it('lists matches in reading order', () => {
    const elements = [el('c', 'rect', 300, 100, { label: 'go' }), el('a', 'rect', 0, 0, { label: 'go' }), el('b', 'rect', 0, 100, { label: 'go' })];
    expect(findOnCanvas(elements, 'go')).toEqual(['a', 'b', 'c']);
  });

  it('finds nothing for an empty query', () => {
    expect(findOnCanvas([el('a', 'rect', 0, 0, { label: 'go' })], '')).toEqual([]);
  });
});
