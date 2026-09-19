import { describe, expect, it } from 'vitest';
import { erasableAlong, eraseSet, topmostAt } from './eraser';
import type { SceneData } from './scene';

const scene: SceneData = {
  elements: [
    { id: 'a', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 },
    { id: 'b', type: 'rect', x: 50, y: 0, w: 20, h: 20, z: 2 },
    { id: 'c', type: 'rect', x: 0, y: 100, w: 20, h: 20, z: 3 },
    { id: 'g', type: 'group', x: 0, y: 100, w: 90, h: 20, z: 4, children: ['c', 'd'] },
    { id: 'd', type: 'rect', x: 70, y: 100, w: 20, h: 20, z: 5 },
  ] as never,
};

describe('what the eraser trail touches', () => {
  it('finds every element a segment crosses', () => {
    expect(erasableAlong(scene, { x: -5, y: 10 }, { x: 80, y: 10 }).sort()).toEqual(['a', 'b']);
  });

  it('finds the element under a click, the topmost only', () => {
    const stacked: SceneData = {
      elements: [
        { id: 'low', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 },
        { id: 'high', type: 'rect', x: 5, y: 5, w: 20, h: 20, z: 2 },
      ] as never,
    };
    expect(erasableAlong(stacked, { x: 10, y: 10 }, { x: 10, y: 10 })).toEqual(['high']);
  });

  it('never marks a group by its own box, only through its children', () => {
    // The segment crosses the group's box between its children.
    expect(erasableAlong(scene, { x: 40, y: 90 }, { x: 40, y: 130 })).toEqual([]);
  });
});

describe('what an erase deletes', () => {
  it('takes the whole group an element belongs to', () => {
    expect([...eraseSet(scene, ['c'])].sort()).toEqual(['c', 'd', 'g']);
  });

  it('is just the element when it is in no group', () => {
    expect([...eraseSet(scene, ['a'])]).toEqual(['a']);
  });
});

describe('what is under a point', () => {
  it('is the topmost element, never a group by its own box', () => {
    expect(topmostAt(scene, { x: 10, y: 10 })).toBe('a');
    expect(topmostAt(scene, { x: 40, y: 110 })).toBeUndefined();
  });
});

// Frames and linear elements draw no area: the eraser hits what is drawn,
// not the element's box.
describe('hitting what is drawn', () => {
  const drawn: SceneData = {
    elements: [
      { id: 'f', type: 'frame', x: 0, y: 0, w: 100, h: 100, z: 1 },
      { id: 'inner', type: 'rect', x: 40, y: 40, w: 20, h: 20, z: 2 },
      { id: 'diag', type: 'line', x: 200, y: 0, w: 100, h: 100, z: 3, points: [0, 0, 100, 100] },
      { id: 's', type: 'stroke', x: 400, y: 0, w: 100, h: 20, z: 4, points: [0, 10, 50, 10, 100, 10] },
    ] as never,
  };

  it('erases a shape inside a frame without the frame', () => {
    expect(erasableAlong(drawn, { x: 45, y: 50 }, { x: 55, y: 50 })).toEqual(['inner']);
    expect(topmostAt(drawn, { x: 20, y: 20 })).toBeUndefined();
  });

  it('erases a frame through its outline', () => {
    expect(erasableAlong(drawn, { x: -5, y: 20 }, { x: 5, y: 20 })).toEqual(['f']);
  });

  it('misses a diagonal line through its box’s empty corner, and hits it on the line', () => {
    expect(erasableAlong(drawn, { x: 280, y: 5 }, { x: 290, y: 15 })).toEqual([]);
    expect(erasableAlong(drawn, { x: 240, y: 60 }, { x: 260, y: 40 })).toEqual(['diag']);
  });

  it('hits a stroke near its path, within the tolerance', () => {
    expect(erasableAlong(drawn, { x: 450, y: 12 }, { x: 450, y: 12 }, 3)).toEqual(['s']);
    expect(erasableAlong(drawn, { x: 450, y: 19 }, { x: 450, y: 19 }, 3)).toEqual([]);
  });
});

// The eraser and selection test the same drawn path: an elbow's dog-leg and
// an arc's bow are where the user sees them, not where the stored points run.
describe('erasing follows the routed path', () => {
  const elbow: SceneData = {
    elements: [
      { id: 'a', type: 'arrow', x: 0, y: 0, w: 100, h: 100, z: 1, points: [0, 0, 100, 100], arrowType: 'elbow' } as never,
    ],
  };

  it('erases where the elbow actually runs', () => {
    // The dog-leg goes out to x 50 and down: (50, 60) is on it, the straight
    // diagonal between the ends is not.
    expect(erasableAlong(elbow, { x: 50, y: 60 }, { x: 50, y: 60 }, 3)).toEqual(['a']);
  });

  it('does not erase where only the straight line between the ends would be', () => {
    expect(erasableAlong(elbow, { x: 20, y: 20 }, { x: 20, y: 20 }, 3)).toEqual([]);
  });
});
