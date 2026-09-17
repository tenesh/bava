import { describe, expect, it } from 'vitest';
import { toolbarFor } from './toolbar';
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
