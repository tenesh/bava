import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import { applyStyle, copyStyle, currentStyle, pasteStyle, styleKeysFor } from './style';
import type { SceneData } from './scene';

const scene = (): SceneData => ({
  elements: [
    { id: 'r', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 1, fill: 'blue' } as never,
    { id: 'c', type: 'cloud', x: 0, y: 0, w: 1, h: 1, z: 2, fill: 'blue' } as never,
    { id: 's', type: 'stroke', x: 0, y: 0, w: 1, h: 1, z: 3, points: [0, 0, 1, 1] } as never,
    { id: 't', type: 'text', x: 0, y: 0, w: 1, h: 1, z: 4, text: 'a', measuredWidth: 1, measuredHeight: 1 } as never,
  ],
});

describe('styleKeysFor', () => {
  // A pen stroke has no fill; text has only a colour.
  it('names the style keys each element type takes', () => {
    expect(styleKeysFor('rect')).toEqual(['fill', 'stroke', 'color']);
    expect(styleKeysFor('stroke')).toEqual(['stroke']);
    expect(styleKeysFor('text')).toEqual(['color']);
    expect(styleKeysFor('group')).toEqual([]);
  });
});

describe('applyStyle', () => {
  it('sets the key on every selected element that takes it, in one step', () => {
    const history = createHistory(scene());
    applyStyle(history, ['r', 's', 't'], 'fill', 'red');
    expect(history.current.elements.find((e) => e.id === 'r')).toMatchObject({ fill: 'red' });
    expect('fill' in history.current.elements.find((e) => e.id === 's')!).toBe(false);
    expect('fill' in history.current.elements.find((e) => e.id === 't')!).toBe(false);
    history.undo();
    expect(history.current.elements.find((e) => e.id === 'r')).toMatchObject({ fill: 'blue' });
    expect(history.canUndo).toBe(false);
  });

  it('removes the key when set back to the default', () => {
    const history = createHistory(scene());
    applyStyle(history, ['r'], 'fill', null);
    expect('fill' in history.current.elements.find((e) => e.id === 'r')!).toBe(false);
  });
});

describe('currentStyle', () => {
  it('reports the shared swatch, the default, or mixed', () => {
    const data = scene();
    expect(currentStyle(data, ['r', 'c'], 'fill')).toBe('blue');
    expect(currentStyle(data, ['s'], 'stroke')).toBe(null);
    const mixed = createHistory(data);
    applyStyle(mixed, ['c'], 'fill', 'green');
    expect(currentStyle(mixed.current, ['r', 'c'], 'fill')).toBe('mixed');
  });

  it('ignores selected elements that do not take the key', () => {
    expect(currentStyle(scene(), ['r', 's'], 'fill')).toBe('blue');
  });

  it('is unavailable when nothing selected takes the key', () => {
    expect(currentStyle(scene(), ['s'], 'fill')).toBe('unavailable');
  });
});

// Copy styles takes what an element shows, defaults included; paste applies
// each copied key to every selected element that takes it, in one step.
describe('copying and pasting a style', () => {
  it('copies the keys an element takes, a default as null', () => {
    const copied = copyStyle({ id: 'r', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 1, fill: 'blue' } as never);
    expect(copied).toEqual({ fill: 'blue', stroke: null, color: null });
    expect(copyStyle({ id: 'l', type: 'line', x: 0, y: 0, w: 1, h: 1, z: 1, points: [], stroke: 'red' } as never)).toEqual({
      stroke: 'red',
    });
  });

  it('pastes onto every selected element, skipping keys it does not take, as one step', () => {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 1, stroke: 'green' },
        { id: 'l', type: 'line', x: 0, y: 0, w: 1, h: 1, z: 2, points: [] },
      ] as never,
    });
    pasteStyle(history, ['a', 'l'], { fill: 'blue', stroke: null, color: 'red' });
    expect(history.current.elements[0]).toMatchObject({ fill: 'blue', color: 'red' });
    expect('stroke' in history.current.elements[0]).toBe(false);
    expect('fill' in history.current.elements[1]).toBe(false);
    history.undo();
    expect(history.current.elements[0]).toMatchObject({ stroke: 'green' });
    expect(history.canUndo).toBe(false);
  });
});
