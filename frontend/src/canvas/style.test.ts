import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import { applyProperty, applyStyle, copyStyle, currentStyle, pasteStyle, propertyKeysFor, setProperty, shownProperty, styleKeysFor } from './style';
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
    // The other style keys too, not only colours.
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

// Style properties, applied like colours: only to the elements that take the
// key, in one step, with the toolbar showing what the selection has.
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

// A closed line takes a fill colour; an open one does not.
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
  it('include a font size, for its label', () => {
    expect(propertyKeysFor('arrow')).toContain('fontSize');
  });
});

// Copy and Paste Styles carry what Excalidraw's do
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

// The kind picker turns a line into an arrow and back, keeping
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
    // A line has no label: nothing of one is left hidden in the file.
    for (const key of ['arrowType', 'startBinding', 'startAnchor', 'endArrowhead', 'label', 'labelPosition', 'fontSize']) expect(line).not.toHaveProperty(key);
  });

  it('shows a line as Line in the kind picker', () => {
    const scene = { elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 1, h: 1, z: 1, points: [0, 0, 1, 1] }] } as never;
    expect(shownProperty(scene, ['l'], 'arrowType')).toBe('line');
  });
});

// A code block's size, whose default is 13, not text's 20.
describe("a code block's font size", () => {
  const block = () => createHistory({ elements: [{ id: 'c', type: 'code', x: 0, y: 0, w: 100, h: 40, z: 1, code: 'x' }] as never });
  it('is a property code takes', () => {
    expect(propertyKeysFor('code')).toContain('fontSize');
  });
  it('keeps 20 on a block, and clears 13, its default', () => {
    const history = block();
    setProperty(history, ['c'], 'fontSize', 20);
    expect(history.current.elements[0]).toMatchObject({ fontSize: 20 });
    setProperty(history, ['c'], 'fontSize', 13);
    expect(history.current.elements[0]).not.toHaveProperty('fontSize');
  });
  it('lets the caller adjust each changed element in the same step', () => {
    const history = block();
    setProperty(history, ['c'], 'fontSize', 16, (element) => {
      element.h = 99;
    });
    expect(history.current.elements[0]).toMatchObject({ fontSize: 16, h: 99 });
    history.undo();
    expect(history.current.elements[0]).toMatchObject({ h: 40 });
  });
});

describe("an arrow label's direction", () => {
  it('is a property arrows take, upright by default', () => {
    expect(propertyKeysFor('arrow')).toContain('labelDirection');
    const history = createHistory({ elements: [{ id: 'a', type: 'arrow', x: 0, y: 0, w: 10, h: 0, z: 1, points: [0, 0, 10, 0], label: 'x' }] as never });
    setProperty(history, ['a'], 'labelDirection', 'along');
    expect(history.current.elements[0]).toMatchObject({ labelDirection: 'along' });
    setProperty(history, ['a'], 'labelDirection', 'upright');
    expect(history.current.elements[0]).not.toHaveProperty('labelDirection');
  });
});

// A size crosses between text and code by its step
// (small, medium, large, extra large), never as an out-of-range number.
describe('a font size across text and code', () => {
  it('maps a text size onto a code block in a mixed selection', () => {
    const history = createHistory({
      elements: [
        { id: 'c', type: 'code', x: 0, y: 0, w: 100, h: 40, z: 1, code: 'x' },
        { id: 't', type: 'text', x: 0, y: 0, w: 10, h: 10, z: 2, text: 'x', measuredWidth: 10, measuredHeight: 10 },
      ] as never,
    });
    setProperty(history, ['c', 't'], 'fontSize', 28);
    expect(history.current.elements[0]).toMatchObject({ fontSize: 16 });
    expect(history.current.elements[1]).toMatchObject({ fontSize: 28 });
  });

  it('maps a pasted size, and lets the caller refit what it changed', () => {
    const history = createHistory({
      elements: [
        { id: 't', type: 'text', x: 0, y: 0, w: 10, h: 10, z: 1, text: 'x', fontSize: 36, measuredWidth: 10, measuredHeight: 10 },
        { id: 'c', type: 'code', x: 0, y: 0, w: 100, h: 40, z: 2, code: 'x' },
      ] as never,
    });
    const refitted: string[] = [];
    pasteStyle(history, ['c'], copyStyle(history.current.elements[0]), (element) => refitted.push(element.id));
    expect(history.current.elements[1]).toMatchObject({ fontSize: 20 });
    expect(refitted).toEqual(['c']);
  });
});

describe('a size that is valid in both scales', () => {
  it('is read in the scale it was chosen in', () => {
    const history = createHistory({
      elements: [
        { id: 'c', type: 'code', x: 0, y: 0, w: 100, h: 40, z: 1, code: 'x' },
        { id: 't', type: 'text', x: 0, y: 0, w: 10, h: 10, z: 2, text: 'x', measuredWidth: 10, measuredHeight: 10 },
      ] as never,
    });
    // Medium, chosen from the text sizes a mixed selection offers.
    setProperty(history, ['c', 't'], 'fontSize', 20);
    expect(history.current.elements[0]).not.toHaveProperty('fontSize');
    const copied = copyStyle({ id: 's', type: 'text', x: 0, y: 0, w: 1, h: 1, z: 1, text: 'x', fontSize: 16 } as never);
    pasteStyle(history, ['c'], copied);
    expect(history.current.elements[0]).toMatchObject({ fontSize: 11 });
  });
});

// A picker shows what is in effect: an element on the default shows the
// default as chosen, not nothing.
describe('what a picker shows as chosen', () => {
  const plain = (): SceneData => ({
    elements: [
      { id: 'a', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 1 } as never,
      { id: 'b', type: 'ellipse', x: 0, y: 0, w: 1, h: 1, z: 2, strokeWidth: 4 } as never,
      { id: 'k', type: 'code', x: 0, y: 0, w: 1, h: 1, z: 3, code: '', measuredWidth: 1, measuredHeight: 1 } as never,
      { id: 'l', type: 'line', x: 0, y: 0, w: 1, h: 1, z: 4, points: [0, 0, 1, 1] } as never,
    ],
  });

  it('is the default where the element sets nothing', () => {
    expect(shownProperty(plain(), ['a'], 'strokeWidth')).toBe(2);
    expect(shownProperty(plain(), ['a'], 'strokeStyle')).toBe('solid');
    expect(shownProperty(plain(), ['a'], 'opacity')).toBe(100);
  });

  it('is the default of the element’s own kind: a code block’s size is 13', () => {
    expect(shownProperty(plain(), ['k'], 'fontSize')).toBe(13);
  });

  it('is what the element sets, mixed where the selection differs, and a line’s kind is Line', () => {
    expect(shownProperty(plain(), ['b'], 'strokeWidth')).toBe(4);
    expect(shownProperty(plain(), ['a', 'b'], 'strokeWidth')).toBe('mixed');
    expect(shownProperty(plain(), ['l'], 'arrowType')).toBe('line');
  });

  // A file may leave `align` out: centred in a shape, left in free text and
  // a frame's label (docs/file-format.md).
  it('shows a shape’s label centred and free text left when the file says nothing', () => {
    const scene = {
      elements: [
        { id: 'r', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 1 },
        { id: 't', type: 'text', x: 0, y: 0, w: 1, h: 1, z: 2, text: 'a', measuredWidth: 1, measuredHeight: 1 },
        { id: 'f', type: 'frame', x: 0, y: 0, w: 1, h: 1, z: 3 },
      ],
    } as never;
    expect(shownProperty(scene, ['r'], 'align')).toBe('center');
    expect(shownProperty(scene, ['t'], 'align')).toBe('left');
    expect(shownProperty(scene, ['f'], 'align')).toBe('left');
    expect(shownProperty(scene, ['r'], 'verticalAlign')).toBe('middle');
    expect(shownProperty(scene, ['f'], 'verticalAlign')).toBe('top');
  });

  it('is unavailable when nothing selected takes the key', () => {
    expect(shownProperty(plain(), ['l'], 'fontSize')).toBe('unavailable');
  });
});

// A frame's label sits at the top when the file says nothing: choosing Middle
// writes it, choosing Top clears it, and the picker shows what was chosen.
describe('a frame label’s vertical alignment', () => {
  const framed = (): SceneData => ({ elements: [{ id: 'f', type: 'frame', x: 0, y: 0, w: 100, h: 80, z: 1 } as never] });

  it('writes Middle and shows it; Top is the default and clears the key', () => {
    const history = createHistory(framed());
    setProperty(history, ['f'], 'verticalAlign', 'middle');
    expect(history.current.elements[0]).toMatchObject({ verticalAlign: 'middle' });
    expect(shownProperty(history.current, ['f'], 'verticalAlign')).toBe('middle');
    setProperty(history, ['f'], 'verticalAlign', 'top');
    expect('verticalAlign' in history.current.elements[0]).toBe(false);
    expect(shownProperty(history.current, ['f'], 'verticalAlign')).toBe('top');
  });
});
