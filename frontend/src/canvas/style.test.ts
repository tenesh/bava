import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import { applyProperty, applyStyle, copyStyle, currentProperty, currentStyle, pasteStyle, propertyKeysFor, setProperty, styleKeysFor } from './style';
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
    // Since 06.16 (X10) the other style keys too, not only colours.
    const copied = copyStyle({ id: 'r', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 1, fill: 'blue' } as never);
    expect(copied).toMatchObject({ fill: 'blue', stroke: null, color: null, strokeWidth: null, opacity: null });
    const line = copyStyle({ id: 'l', type: 'line', x: 0, y: 0, w: 1, h: 1, z: 1, points: [], stroke: 'red' } as never);
    expect(line).toMatchObject({ stroke: 'red', strokeWidth: null });
    expect(line).not.toHaveProperty('fill');
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

// The style properties of Milestone 6.3, applied like colours: only to the
// elements that take the key, in one step, with the toolbar showing what the
// selection has.
describe('style properties', () => {
  const scene = (): SceneData => ({
    elements: [
      { id: 'r', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 } as never,
      { id: 'e', type: 'ellipse', x: 0, y: 0, w: 10, h: 10, z: 2 } as never,
      { id: 'a', type: 'arrow', x: 0, y: 0, w: 10, h: 10, z: 3, points: [0, 0, 10, 10] } as never,
      { id: 't', type: 'text', x: 0, y: 0, w: 10, h: 10, z: 4, text: 'x', measuredWidth: 10, measuredHeight: 10 } as never,
    ],
  });

  it('names the keys each element type takes', () => {
    expect(propertyKeysFor('rect')).toContain('edges');
    // An ellipse has no corners, as in Excalidraw.
    expect(propertyKeysFor('ellipse')).not.toContain('edges');
    expect(propertyKeysFor('arrow')).toEqual(
      expect.arrayContaining(['strokeWidth', 'strokeStyle', 'opacity', 'arrowType', 'startArrowhead', 'endArrowhead']),
    );
    expect(propertyKeysFor('arrow')).not.toContain('edges');
    expect(propertyKeysFor('text')).toEqual(expect.arrayContaining(['fontSize', 'align', 'opacity']));
    expect(propertyKeysFor('text')).not.toContain('strokeWidth');
    expect(propertyKeysFor('group')).toEqual(['opacity']);
  });

  it('applies a property to every selected element that takes it, in one step', () => {
    const history = createHistory(scene());
    applyProperty(history, ['r', 'a', 't'], 'strokeWidth', 4);
    const byId = Object.fromEntries(history.current.elements.map((el) => [el.id, el]));
    expect(byId.r).toMatchObject({ strokeWidth: 4 });
    expect(byId.a).toMatchObject({ strokeWidth: 4 });
    expect('strokeWidth' in byId.t).toBe(false);
    history.undo();
    expect('strokeWidth' in history.current.elements[0]).toBe(false);
    expect(history.canUndo).toBe(false);
  });

  it('clears a property when set back to the default', () => {
    const history = createHistory(scene());
    applyProperty(history, ['r'], 'opacity', 40);
    applyProperty(history, ['r'], 'opacity', null);
    expect('opacity' in history.current.elements[0]).toBe(false);
  });

  it('reports what the selection shows: shared, default or mixed', () => {
    const history = createHistory(scene());
    applyProperty(history, ['r'], 'strokeWidth', 4);
    expect(currentProperty(history.current, ['r'], 'strokeWidth')).toBe(4);
    expect(currentProperty(history.current, ['e'], 'strokeWidth')).toBeNull();
    expect(currentProperty(history.current, ['r', 'e'], 'strokeWidth')).toBe('mixed');
    expect(currentProperty(history.current, ['t'], 'strokeWidth')).toBe('unavailable');
  });
});

// Absent means the default (docs/file-format.md), so choosing the default
// removes the key rather than writing what the reader would assume anyway.
// Without this the toolbar could never take an element back to unset.
describe('setting a property from a control', () => {
  const scene = (): SceneData => ({
    elements: [{ id: 'r', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1, strokeWidth: 4 } as never],
  });

  it('clears the key when the chosen value is the default', () => {
    const history = createHistory(scene());
    setProperty(history, ['r'], 'strokeWidth', 2);
    expect('strokeWidth' in history.current.elements[0]).toBe(false);
  });

  it('writes anything else', () => {
    const history = createHistory(scene());
    setProperty(history, ['r'], 'strokeWidth', 1);
    expect(history.current.elements[0]).toMatchObject({ strokeWidth: 1 });
  });
});

// 06.15 P21: a closed line takes a fill colour; an open one does not.
describe('the fill of a closed line', () => {
  it('is set on a closed line and refused by an open one', () => {
    const history = createHistory({
      elements: [
        { id: 'loop', type: 'line', x: 0, y: 0, w: 10, h: 10, z: 1, points: [0, 0, 10, 0, 10, 10, 0, 0], closed: true },
        { id: 'open', type: 'line', x: 0, y: 0, w: 10, h: 10, z: 2, points: [0, 0, 10, 0, 10, 10] },
      ] as never,
    });
    applyStyle(history, ['loop', 'open'], 'fill', 'blue');
    expect(history.current.elements[0]).toMatchObject({ fill: 'blue' });
    expect(history.current.elements[1]).not.toHaveProperty('fill');
    expect(currentStyle(history.current, ['open'], 'fill')).toBe('unavailable');
  });
});

describe('the properties an arrow takes', () => {
  it('include a font size, for its label (06.16, L8)', () => {
    expect(propertyKeysFor('arrow')).toContain('fontSize');
  });
});

// 06.16 X10: Copy and Paste Styles carry what Excalidraw's do
// (`actions/actionStyles.ts:118-186`): colours, width, line style, opacity,
// edges, text size and, arrow to arrow, both heads.
describe('copying and pasting a style, as Excalidraw', () => {
  it('carries widths, line style, opacity, edges and heads', () => {
    const history = createHistory({
      elements: [
        { id: 'src', type: 'arrow', x: 0, y: 0, w: 10, h: 0, z: 1, points: [0, 0, 10, 0], stroke: 'red', strokeWidth: 4, strokeStyle: 'dashed', opacity: 50, endArrowhead: 'triangle' },
        { id: 'arrow', type: 'arrow', x: 0, y: 0, w: 10, h: 0, z: 2, points: [0, 0, 10, 0] },
        { id: 'rect', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 3, edges: 'round' },
      ] as never,
    });
    const copied = copyStyle(history.current.elements[0]);
    pasteStyle(history, ['arrow', 'rect'], copied);
    expect(history.current.elements[1]).toMatchObject({ stroke: 'red', strokeWidth: 4, strokeStyle: 'dashed', opacity: 50, endArrowhead: 'triangle' });
    expect(history.current.elements[2]).toMatchObject({ stroke: 'red', strokeWidth: 4, strokeStyle: 'dashed', opacity: 50 });
    expect(history.current.elements[2]).not.toHaveProperty('endArrowhead');
    // An arrow takes no edges, so the rectangle keeps its own.
    expect(history.current.elements[2]).toMatchObject({ edges: 'round' });
  });
});

// 06.16 X11: the kind picker turns a line into an arrow and back, keeping
// its points (Excalidraw's `ConvertElementTypePopup.tsx:529-601`).
describe('turning a line into an arrow and back', () => {
  it('makes a line an arrow of the chosen kind, its points kept', () => {
    const history = createHistory({
      elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 100, h: 50, z: 1, points: [0, 0, 50, 50, 100, 0], edges: 'round', closed: true, fill: 'blue' }] as never,
    });
    setProperty(history, ['l'], 'arrowType', 'arc');
    const arrow = history.current.elements[0] as unknown as Record<string, unknown>;
    expect(arrow).toMatchObject({ type: 'arrow', arrowType: 'arc', points: [0, 0, 50, 50, 100, 0] });
    expect(arrow).not.toHaveProperty('edges');
    expect(arrow).not.toHaveProperty('closed');
    expect(arrow).not.toHaveProperty('fill');
  });

  it('makes an arrow a line, letting go of its shapes and heads', () => {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: -100, y: -50, w: 94, h: 100, z: 1 },
        { id: 'r', type: 'arrow', x: 0, y: 0, w: 100, h: 0, z: 2, points: [0, 0, 100, 0], arrowType: 'arc', startBinding: 'a', startAnchor: [1, 0.5], endArrowhead: 'triangle', label: 'x', labelPosition: 0.3, fontSize: 28 },
      ] as never,
    });
    setProperty(history, ['r'], 'arrowType', 'line');
    const line = history.current.elements[1] as unknown as Record<string, unknown>;
    expect(line).toMatchObject({ type: 'line', points: [0, 0, 100, 0], edges: 'round' });
    // A line has no label: nothing of one is left hidden in the file (review).
    for (const key of ['arrowType', 'startBinding', 'startAnchor', 'endArrowhead', 'label', 'labelPosition', 'fontSize']) expect(line).not.toHaveProperty(key);
  });

  it('shows a line as Line in the kind picker', () => {
    const scene = { elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 1, h: 1, z: 1, points: [0, 0, 1, 1] }] } as never;
    expect(currentProperty(scene, ['l'], 'arrowType')).toBe('line');
  });
});
