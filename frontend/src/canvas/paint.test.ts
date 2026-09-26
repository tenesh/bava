import { describe, expect, it } from 'vitest';
import { paintFor, ROUND_SHARE } from './paint';
import type { SceneElement } from './scene';
import { createHistory } from './history';
import { setProperty } from './style';

const read = (values: Record<string, string>) => (name: string) => values[name] ?? '';

const theme = read({
  '--color-shape-fill': 'ivory',
  '--color-shape-stroke': 'slategray',
  '--color-shape-text': 'black',
  '--swatch-blue-fill': 'lightblue',
  '--swatch-blue-stroke': 'steelblue',
  '--swatch-blue-text': 'navy',
  '--size-dash': '6px',
  '--size-dot': '2px',
  '--size-arrowhead': '10px',
  '--radius-shape-round': '32px',
  '--font-ui': 'Geist',
  '--text-body': '16px',
  '--leading-tight': '1.2',
});

const el = (over: Record<string, unknown>): SceneElement =>
  ({ id: 'e', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1, ...over }) as SceneElement;

describe('how an element paints', () => {
  it('takes its colours from the swatch it names, and the theme otherwise', () => {
    // Each colour key is its own: a blue fill does not make the border blue.
    expect(paintFor(el({ fill: 'blue', stroke: 'blue' }), theme)).toMatchObject({ fill: 'lightblue', stroke: 'steelblue' });
    expect(paintFor(el({ fill: 'blue' }), theme)).toMatchObject({ fill: 'lightblue', stroke: 'slategray' });
    expect(paintFor(el({}), theme)).toMatchObject({ fill: 'ivory', stroke: 'slategray' });
  });

  it('uses the stored stroke width', () => {
    expect(paintFor(el({ strokeWidth: 4 }), theme).strokeWidth).toBe(4);
  });

  // The file format's "absent means 2": the theme has no say in what a file
  // means, or picking Medium (which clears the key) would draw something else.
  it('draws a shape with no stroke width at 2', () => {
    expect(paintFor(el({}), theme).strokeWidth).toBe(2);
  });

  it('draws a pen stroke with no stroke width at 2', () => {
    expect(paintFor(el({ type: 'stroke', points: [0, 0, 5, 5] }), theme).strokeWidth).toBe(2);
  });

  it('draws a shape with no font size at 20', () => {
    expect(paintFor(el({ label: 'A' }), theme).font.size).toBe(20);
    expect(paintFor(el({ type: 'text', text: 'hi' }), theme).font.size).toBe(20);
  });

  it('draws what was picked when Medium and 20 clear their keys', () => {
    const history = createHistory({ elements: [el({ strokeWidth: 4, fontSize: 28, label: 'A' })] });
    setProperty(history, ['e'], 'strokeWidth', 2);
    setProperty(history, ['e'], 'fontSize', 20);
    const paint = paintFor(history.current.elements[0], theme);
    expect(paint.strokeWidth).toBe(2);
    expect(paint.font.size).toBe(20);
  });

  it('turns a line style into a dash pattern', () => {
    expect(paintFor(el({ strokeStyle: 'dashed' }), theme).dash).toEqual([6, 6]);
    expect(paintFor(el({ strokeStyle: 'dotted' }), theme).dash).toEqual([2, 4]);
    expect(paintFor(el({}), theme).dash).toEqual([]);
  });

  it('reads opacity as a fraction, and clamps what is out of range', () => {
    expect(paintFor(el({ opacity: 40 }), theme).opacity).toBe(0.4);
    expect(paintFor(el({}), theme).opacity).toBe(1);
    expect(paintFor(el({ opacity: 140 }), theme).opacity).toBe(1);
    expect(paintFor(el({ opacity: -20 }), theme).opacity).toBe(0);
  });

  it('rounds a rectangle by the token and a polygon by its shorter side', () => {
    expect(paintFor(el({ edges: 'round' }), theme).cornerRadius).toBe(32);
    expect(paintFor(el({ type: 'diamond', edges: 'round' }), theme).cornerRadius).toBe(50 * ROUND_SHARE);
    expect(paintFor(el({ type: 'diamond' }), theme).cornerRadius).toBe(0);
  });

  it('describes text with the bundled font and the stored size', () => {
    const paint = paintFor(el({ type: 'text', text: 'hi', fontSize: 28, align: 'right' }), theme);
    expect(paint.font).toMatchObject({ family: 'Geist', size: 28, align: 'right', lineHeight: 1.2 });
    expect(paint.font.colour).toBe('black');
  });

  // Free text sits at the top of its box, as Konva draws it; a shape's label
  // is centred in the shape. The exporter reads these, so a disagreement here
  // is a picture that differs from the canvas.
  it('starts free text at the top of its box', () => {
    expect(paintFor(el({ type: 'text', text: 'hi' }), theme).font.verticalAlign).toBe('top');
    expect(paintFor(el({ type: 'text', text: 'hi', verticalAlign: 'middle' }), theme).font.verticalAlign).toBe('middle');
  });

  it('gives a shape label the centred defaults and a frame label the top-left ones', () => {
    expect(paintFor(el({ label: 'A' }), theme).font).toMatchObject({ align: 'center', verticalAlign: 'middle' });
    expect(paintFor(el({ type: 'frame', label: 'A' }), theme).font).toMatchObject({ align: 'left', verticalAlign: 'top' });
  });

  // A group is a wrapper: its children are the drawing.
  it('gives a group nothing to draw', () => {
    const paint = paintFor(el({ type: 'group', children: [] }), theme);
    expect(paint.fill).toBe('');
    expect(paint.stroke).toBe('');
  });

  it('leaves a line unfilled, and fills an arrow in its own colour for the heads', () => {
    expect(paintFor(el({ type: 'line', points: [0, 0, 5, 5] }), theme).fill).toBe('');
    expect(paintFor(el({ type: 'arrow', points: [0, 0, 5, 5] }), theme)).toMatchObject({
      fill: 'slategray',
      stroke: 'slategray',
    });
  });
});
