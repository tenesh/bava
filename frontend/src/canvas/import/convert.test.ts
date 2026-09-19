import { describe, expect, it } from 'vitest';
import layout from './__fixtures__/containers.json';
import { toElements, unplaceable } from './convert';
import type { Layout } from './convert';
import { isShapeType } from '../scene';

const fixture = layout as Layout;
const converted = () => toElements(fixture, { at: { x: 0, y: 0 } });
const byLabel = (elements: ReturnType<typeof converted>, label: string) =>
  elements.find((e) => (e as { label?: string }).label === label)!;

describe('converting a D2 layout into canvas elements', () => {
  it('makes one element per shape and one arrow per connection', () => {
    const elements = converted();
    expect(elements.filter((e) => e.type === 'arrow')).toHaveLength(fixture.connections.length);
    expect(elements.filter((e) => e.type !== 'arrow')).toHaveLength(fixture.shapes.length);
  });

  // A container is a frame that owns what it holds, so dragging it later
  // carries its contents (`diagrams-as-shapes.md`).
  it('turns a container into a frame whose children record it', () => {
    const elements = converted();
    const frame = byLabel(elements, 'Frontend');
    expect(frame.type).toBe('frame');
    const child = byLabel(elements, 'Source Editor');
    expect((child as { frame?: string }).frame).toBe(frame.id);
    expect(isShapeType(child.type)).toBe(true);
  });

  it('binds each arrow to the elements its connection named', () => {
    const elements = converted();
    const editor = byLabel(elements, 'Source Editor');
    const compile = byLabel(elements, 'Compile');
    const arrow = elements.find((e) => (e as { label?: string }).label === 'source')!;
    expect(arrow).toMatchObject({ type: 'arrow', startBinding: editor.id, endBinding: compile.id });
  });

  it('carries the arrowheads the connection asked for', () => {
    const arrow = converted().find((e) => (e as { label?: string }).label === 'source') as Record<string, unknown>;
    expect(arrow.endArrowhead).toBe('triangle');
    expect(arrow.startArrowhead).toBe('none');
  });

  it('keeps every label', () => {
    const labels = converted().map((e) => (e as { label?: string }).label);
    for (const label of ['Frontend', 'Backend', 'Source Editor', 'Canvas', 'Compile', 'Layout', 'Render', 'source', 'svg']) {
      expect(labels).toContain(label);
    }
  });

  it('keeps the sizes D2 laid out, one to one', () => {
    const frame = byLabel(converted(), 'Frontend');
    const source = fixture.shapes.find((s) => s.id === 'frontend')!;
    expect({ w: frame.w, h: frame.h }).toEqual({ w: source.w, h: source.h });
  });

  // The user's decision: a generated shape looks like one drawn by hand, and
  // follows the theme. D2's palette is not carried at all.
  it('gives nothing a colour', () => {
    for (const element of converted()) {
      expect(element).not.toHaveProperty('fill');
      expect(element).not.toHaveProperty('stroke');
      expect(element).not.toHaveProperty('color');
    }
  });

  it('centres the whole diagram where it is asked to land', () => {
    const elements = toElements(fixture, { at: { x: 500, y: 300 } });
    const xs = elements.map((e) => e.x);
    const ys = elements.map((e) => e.y);
    const centre = {
      x: (Math.min(...xs) + Math.max(...elements.map((e) => e.x + e.w))) / 2,
      y: (Math.min(...ys) + Math.max(...elements.map((e) => e.y + e.h))) / 2,
    };
    expect(Math.abs(centre.x - 500)).toBeLessThan(1);
    expect(Math.abs(centre.y - 300)).toBeLessThan(1);
  });

  it('gives everything a fresh id, never D2 own', () => {
    const elements = converted();
    const ids = elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const shape of fixture.shapes) expect(ids).not.toContain(shape.id);
  });

  it('paints containers behind their contents', () => {
    const elements = converted();
    const frame = byLabel(elements, 'Frontend');
    const child = byLabel(elements, 'Source Editor');
    expect(frame.z).toBeLessThan(child.z);
  });

  it('converts an empty layout into nothing at all', () => {
    expect(toElements({ shapes: [], connections: [] }, { at: { x: 0, y: 0 } })).toEqual([]);
  });
});

// D2 features Bava cannot place yet (a sequence diagram's lifelines) name
// endpoints that are not shapes. A half-bound arrow hanging off a participant
// is worse than no arrow: the user did not draw it and cannot explain it.
describe('a connection that names something that is not a shape', () => {
  const stray: Layout = {
    shapes: [{ id: 'alice', type: 'rectangle', x: 0, y: 0, w: 60, h: 40, label: 'Alice' }],
    connections: [
      {
        id: '(alice -- )[0]',
        src: 'alice',
        dst: 'alice-lifeline-end-3851299086',
        route: [
          { x: 30, y: 40 },
          { x: 30, y: 280 },
        ],
      },
    ],
  };

  it('is left out rather than inserted half-attached', () => {
    const elements = toElements(stray, { at: { x: 0, y: 0 } });
    expect(elements.filter((e) => e.type === 'arrow')).toHaveLength(0);
    expect(elements).toHaveLength(1);
  });

  it('reports what it could not place, so the caller can say so', () => {
    expect(unplaceable(stray)).toBe(1);
    expect(unplaceable({ shapes: [], connections: [] })).toBe(0);
  });
});
