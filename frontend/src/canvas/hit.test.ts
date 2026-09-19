import { describe, expect, it } from 'vitest';
import { drawnPathOf, nearElement, pathBounds } from './hit';
import type { SceneElement } from './scene';

const arrow = (over: Record<string, unknown> = {}): SceneElement =>
  ({ id: 'a', type: 'arrow', x: 0, y: 0, w: 100, h: 100, z: 1, points: [0, 0, 100, 100], ...over }) as SceneElement;

describe('what an element draws, for hit-testing', () => {
  it('is the routed path of an arrow, in scene coordinates', () => {
    expect(drawnPathOf(arrow({ x: 10, y: 20 }))).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 120 },
    ]);
  });

  it('follows an elbow around its corners', () => {
    expect(drawnPathOf(arrow({ arrowType: 'elbow' })).length).toBeGreaterThan(2);
  });

  it('is the outline of a frame, and nothing for a filled shape', () => {
    expect(drawnPathOf({ id: 'f', type: 'frame', x: 0, y: 0, w: 10, h: 10, z: 1 } as SceneElement)).toHaveLength(5);
    expect(drawnPathOf({ id: 'r', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 } as SceneElement)).toEqual([]);
  });
});

// A diagonal line's box is mostly empty space: clicking the corner of it must
// not select the line (.ai/rules/canvas.md, carried from 06.2.1).
describe('hitting a line by its path', () => {
  it('hits near the line and misses the empty corner of its box', () => {
    expect(nearElement(arrow(), { x: 50, y: 52 }, 3)).toBe(true);
    expect(nearElement(arrow(), { x: 5, y: 95 }, 3)).toBe(false);
  });

  it('hits a rotated line where it is drawn', () => {
    const turned = arrow({ points: [0, 0, 100, 0], h: 0, angle: 90 });
    // Turned a quarter about its centre (50, 0), the line runs vertically.
    expect(nearElement(turned, { x: 50, y: 40 }, 3)).toBe(true);
    expect(nearElement(turned, { x: 90, y: 0 }, 3)).toBe(false);
  });
});

describe('the box around what is drawn', () => {
  // An arc bows away from the straight line between its ends: the stored box
  // has to hold the curve, or selection and export cut it off.
  it('covers an arc bow', () => {
    const straight = pathBounds(drawnPathOf(arrow({ points: [0, 0, 100, 0], h: 0 })));
    const arced = pathBounds(drawnPathOf(arrow({ points: [0, 0, 100, 0], h: 0, arrowType: 'arc' })));
    expect(arced.h).toBeGreaterThan(straight.h);
  });

  it('is empty for an empty path', () => {
    expect(pathBounds([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
