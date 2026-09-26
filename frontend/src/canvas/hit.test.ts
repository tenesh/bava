import { describe, expect, it } from 'vitest';
import { drawnPathOf, insideFilledLine, nearElement, pathBounds } from './hit';
import type { SceneElement } from './scene';
import { pathOf } from './arrows';

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

  // 06.14 E4: the hit test measures the rounded corners the stage draws.
  it("follows an elbow's rounded corners, not the square ones", () => {
    const path = drawnPathOf(arrow({ arrowType: 'elbow', points: [0, 0, 100, 0, 100, 100] }));
    const flat = pathOf([0, 0, 100, 0, 100, 100], 'elbow');
    expect(path).toEqual(Array.from({ length: flat.length / 2 }, (_, i) => ({ x: flat[i * 2], y: flat[i * 2 + 1] })));
    expect(path).not.toContainEqual({ x: 100, y: 0 });
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
  // An arc curves away from its points: the box has to hold the curve, or
  // selection and export cut it off. Since 06.15 (V2) a two-point arc is
  // straight, so its box is flat.
  it('covers an arc curve, and nothing more for a two-point one', () => {
    const bent = pathBounds(drawnPathOf(arrow({ points: [0, 0, 50, 40, 100, 0], h: 40, arrowType: 'arc' })));
    const cornered = pathBounds(drawnPathOf(arrow({ points: [0, 0, 50, 40, 100, 0], h: 40 })));
    expect(bent.h).toBeGreaterThanOrEqual(cornered.h);
    expect(pathBounds(drawnPathOf(arrow({ points: [0, 0, 100, 0], h: 0, arrowType: 'arc' }))).h).toBe(0);
  });

  it('is empty for an empty path', () => {
    expect(pathBounds([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

// 06.15 P21: a filled closed line is grabbed from inside, as a shape is.
describe('inside a closed line', () => {
  it('counts as on it when filled, not when hollow', () => {
    const loop = { id: 'l', type: 'line', x: 0, y: 0, w: 100, h: 100, z: 1, points: [0, 0, 100, 0, 100, 100, 0, 100, 0, 0], closed: true } as never as SceneElement;
    expect(insideFilledLine({ ...loop, fill: 'blue' } as SceneElement, { x: 50, y: 50 })).toBe(true);
    expect(insideFilledLine(loop, { x: 50, y: 50 })).toBe(false);
  });
});
