import { describe, expect, it } from 'vitest';
import { splitForWidth, toolbarFor } from './toolbar';
import type { SceneData } from './scene';

const scene: SceneData = {
  elements: [
    { id: 'r', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
    { id: 'l', type: 'line', x: 0, y: 0, w: 10, h: 10, z: 2, points: [0, 0, 10, 10] },
    { id: 't', type: 'text', x: 0, y: 0, w: 10, h: 10, z: 3, text: 'x', measuredWidth: 10, measuredHeight: 10 },
  ] as never,
};

describe('the selection toolbar', () => {
  it('is hidden with nothing selected', () => {
    expect(toolbarFor(scene, []).visible).toBe(false);
  });

  it('offers the colours the selection takes, the union for a mixed selection', () => {
    expect(toolbarFor(scene, ['r']).styles).toEqual(['fill', 'stroke', 'color']);
    expect(toolbarFor(scene, ['l']).styles).toEqual(['stroke']);
    expect(toolbarFor(scene, ['l', 't']).styles).toEqual(['stroke', 'color']);
  });

  it('adds align from two units and distribute from three', () => {
    expect(toolbarFor(scene, ['r'])).toMatchObject({ align: false, distribute: false });
    expect(toolbarFor(scene, ['r', 'l'])).toMatchObject({ align: true, distribute: false });
    expect(toolbarFor(scene, ['r', 'l', 't'])).toMatchObject({ align: true, distribute: true });
  });
});

describe('units in the toolbar', () => {
  it('counts a group selected with its children as one unit', () => {
    const grouped: SceneData = {
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
        { id: 'b', type: 'rect', x: 20, y: 0, w: 10, h: 10, z: 2 },
        { id: 'g', type: 'group', x: 0, y: 0, w: 30, h: 10, z: 3, children: ['a', 'b'] },
      ] as never,
    };
    expect(toolbarFor(grouped, ['a', 'b', 'g'])).toMatchObject({ align: false, distribute: false });
  });
});

// The row shows only what the selection takes, grouped, and moves what does
// not fit into More (canvas-toolbar.md, "The selection toolbar's layout").
describe('the adaptive row', () => {
  const scene: SceneData = {
    elements: [
      { id: 'r', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
      { id: 'a', type: 'arrow', x: 0, y: 0, w: 10, h: 10, z: 2, points: [0, 0, 10, 10] },
      { id: 't', type: 'text', x: 0, y: 0, w: 10, h: 10, z: 3, text: 'x', measuredWidth: 10, measuredHeight: 10 },
    ] as never,
  };
  const ids = (model: ReturnType<typeof toolbarFor>) => model.controls.map((c) => c.id);

  it('gives a shape colours, stroke and label controls, in groups', () => {
    const model = toolbarFor(scene, ['r']);
    expect(ids(model)).toEqual([
      'fill', 'stroke', 'color',
      'strokeWidth', 'strokeStyle', 'edges', 'opacity',
      'fontSize', 'align', 'verticalAlign',
    ]);
    expect(model.controls.find((c) => c.id === 'strokeWidth')?.group).toBe('stroke');
  });

  it('gives an arrow its own controls and no label ones', () => {
    expect(ids(toolbarFor(scene, ['a']))).toEqual([
      'stroke', 'strokeWidth', 'strokeStyle', 'opacity', 'arrowType', 'startArrowhead', 'endArrowhead',
    ]);
  });

  it('gives text its colour, opacity, size and align', () => {
    expect(ids(toolbarFor(scene, ['t']))).toEqual(['color', 'opacity', 'fontSize', 'align']);
  });

  it('shows what every selected element takes, for a mixed selection', () => {
    const mixed = ids(toolbarFor(scene, ['r', 'a']));
    expect(mixed).toContain('strokeWidth');
    expect(mixed).toContain('arrowType');
    expect(mixed).toContain('fill');
  });
});

describe('overflowing into More', () => {
  const controls = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, group: 'stroke' as const, kind: 'options' as const }));

  it('keeps what fits and moves the rest', () => {
    // Room for six controls: five stay, the sixth slot is More itself.
    const split = splitForWidth(controls, 6);
    expect(split.shown.map((c) => c.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4']);
    expect(split.overflow.map((c) => c.id)).toEqual(['c5', 'c6', 'c7', 'c8', 'c9']);
  });

  it('moves nothing when everything fits', () => {
    expect(splitForWidth(controls, 20).overflow).toEqual([]);
  });

  it('keeps at least one control, however narrow', () => {
    expect(splitForWidth(controls, 0).shown).toHaveLength(1);
  });
});
