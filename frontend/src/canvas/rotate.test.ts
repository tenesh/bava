import { describe, expect, it } from 'vitest';
import {
  angleOf,
  canRotate,
  containsPoint,
  cornersOf,
  normalise,
  rotateElements,
  rotatedBounds,
  rotatePoint,
  scaleRotatedInto,
  snapDegrees,
  toLocal,
} from './rotate';
import type { SceneElement } from './scene';

const at = (x: number, y: number) => ({ x, y });
const close = (value: number) => Math.round(value * 1000) / 1000;
const rect = (over: Partial<SceneElement> = {}): SceneElement =>
  ({ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1, ...over }) as SceneElement;

describe('the angle of a drag', () => {
  // The handle sits above the selection, so straight up is where a rotation
  // starts: dragging to the right turns the element clockwise.
  it('reads zero straight up and grows clockwise', () => {
    const centre = at(0, 0);
    expect(angleOf(centre, at(0, -10))).toBe(0);
    expect(angleOf(centre, at(10, 0))).toBe(90);
    expect(angleOf(centre, at(0, 10))).toBe(180);
    expect(angleOf(centre, at(-10, 0))).toBe(270);
  });

  it('is zero at the centre, where there is no direction to read', () => {
    expect(angleOf(at(5, 5), at(5, 5))).toBe(0);
  });

  it('wraps rather than running past a full turn', () => {
    expect(normalise(370)).toBe(10);
    expect(normalise(-90)).toBe(270);
    expect(normalise(360)).toBe(0);
  });
});

describe('snapping while Shift is held', () => {
  it('goes to the nearest fifteen degrees', () => {
    expect(snapDegrees(20)).toBe(15);
    expect(snapDegrees(38)).toBe(45);
    expect(snapDegrees(7)).toBe(0);
    expect(snapDegrees(359)).toBe(0);
  });
});

describe('turning a point about a centre', () => {
  it('turns clockwise on screen, where y grows downward', () => {
    const turned = rotatePoint(at(10, 0), at(0, 0), 90);
    expect(close(turned.x)).toBe(0);
    expect(close(turned.y)).toBe(10);
  });

  it('leaves the centre where it is', () => {
    expect(rotatePoint(at(4, 9), at(4, 9), 137)).toEqual(at(4, 9));
  });
});

describe('rotating a selection', () => {
  it('turns one element about its own centre, leaving it in place', () => {
    const [turned] = rotateElements([rect()], { x: 50, y: 25 }, 30);
    expect(turned).toMatchObject({ x: 0, y: 0, angle: 30 });
  });

  it('adds to an angle an element already had, and wraps', () => {
    const [turned] = rotateElements([rect({ angle: 350 } as Partial<SceneElement>)], { x: 50, y: 25 }, 20);
    expect(turned.angle).toBe(10);
  });

  // A group turns as one object: every element takes the angle, and its centre
  // orbits the shared centre rather than spinning where it stands.
  it('orbits each element about the shared centre', () => {
    const a = rect({ id: 'a', x: 0, y: 0, w: 20, h: 20 });
    const b = rect({ id: 'b', x: 80, y: 0, w: 20, h: 20 });
    const [, moved] = rotateElements([a, b], { x: 50, y: 10 }, 180);
    // b's centre was at (90, 10); half a turn about (50, 10) puts it at (10, 10).
    expect(close(moved.x)).toBe(0);
    expect(close(moved.y)).toBe(0);
    expect(moved.angle).toBe(180);
  });

  // An elbow arrow is drawn as orthogonal segments; turning it would leave
  // them at an angle, which is the one thing an elbow arrow is not.
  it('leaves an elbow arrow alone', () => {
    const elbow = { id: 'e', type: 'arrow', x: 0, y: 0, w: 40, h: 20, z: 1, arrowType: 'elbow' } as unknown as SceneElement;
    expect(canRotate(elbow)).toBe(false);
    // It still travels with the selection: a group turning about its centre
    // cannot leave the arrow joining its shapes behind.
    const [same] = rotateElements([elbow], { x: 100, y: 10 }, 180);
    expect(same.angle).toBeUndefined();
    expect(same.x).toBe(160);
  });

  it('rotates every other arrow', () => {
    const straight = { id: 'a', type: 'arrow', x: 0, y: 0, w: 40, h: 20, z: 1 } as unknown as SceneElement;
    expect(canRotate(straight)).toBe(true);
    const [turned] = rotateElements([straight], { x: 20, y: 10 }, 45);
    expect(turned.angle).toBe(45);
  });

  // `docs/file-format.md` says 0 to 359: rounding after wrapping wrote 360 for
  // a drag that ended a hair short of a full turn, which is out of range and
  // slipped past the rule that upright means no key.
  it('never writes a full turn', () => {
    const [turned] = rotateElements([rect({ angle: 359.9996 } as Partial<SceneElement>)], { x: 50, y: 25 }, 0.0002);
    expect('angle' in turned).toBe(false);
  });

  it('records no angle at all when the element comes back to zero', () => {
    const [turned] = rotateElements([rect({ angle: 90 } as Partial<SceneElement>)], { x: 50, y: 25 }, 270);
    expect('angle' in turned).toBe(false);
  });
});

describe('a rotated element on the canvas', () => {
  const turned = rect({ angle: 90 } as Partial<SceneElement>);

  it('has four corners about its centre', () => {
    const corners = cornersOf(turned).map((c) => `${close(c.x)},${close(c.y)}`);
    // The 100x50 box, turned a quarter turn about (50, 25), is 50 wide and 100 tall.
    expect(corners).toContain('75,-25');
    expect(corners).toContain('25,75');
  });

  it('reports the box that holds it, for the marquee and the eraser', () => {
    const bounds = rotatedBounds(turned);
    expect({ x: close(bounds.x), y: close(bounds.y), w: close(bounds.w), h: close(bounds.h) }).toEqual({
      x: 25,
      y: -25,
      w: 50,
      h: 100,
    });
  });

  it('is unchanged when it is not rotated', () => {
    expect(rotatedBounds(rect())).toEqual({ x: 0, y: 0, w: 100, h: 50 });
  });

  // The point that matters: a click inside the turned shape hits it, and one
  // in the corner of the box around it does not.
  it('is hit where it is drawn, not where its box is', () => {
    expect(containsPoint(turned, at(50, 60))).toBe(true);
    // Inside the stored box, but the quarter turn moved the shape off it.
    expect(containsPoint(turned, at(10, 25))).toBe(false);
    expect(containsPoint(rect(), at(50, 25))).toBe(true);
    expect(containsPoint(rect(), at(50, 60))).toBe(false);
  });

  it('reads a point in its own frame, for resizing and erasing', () => {
    const local = toLocal(at(50, 60), turned);
    expect({ x: close(local.x), y: close(local.y) }).toEqual({ x: 85, y: 25 });
  });
});

// A multi-selection's frame is the box around everything as drawn, so a
// rotated member has to be scaled through its drawn bounds. Scaling its stored
// box against that frame stretches the wrong axis and pushes it outside.
describe('scaling a rotated element into a new frame', () => {
  const from = { x: 0, y: 0, w: 100, h: 100 };
  const to = { x: 0, y: 0, w: 200, h: 100 };
  const bar = { id: 'a', type: 'rect', x: 0, y: 40, w: 100, h: 20, z: 1, angle: 90 } as unknown as SceneElement;

  it('scales along the element own axes, exactly at a quarter turn', () => {
    const scaled = scaleRotatedInto(bar, from, to);
    // Turned a quarter, the bar's width runs down the screen: the frame's
    // horizontal stretch grows its height, not its width.
    expect(scaled.w).toBe(100);
    expect(scaled.h).toBe(40);
    expect(scaled.angle).toBe(90);
  });

  it('keeps the element inside the frame it was dragged to', () => {
    const scaled = scaleRotatedInto(bar, from, to);
    const bounds = rotatedBounds(scaled);
    // Turning by a quarter leaves floating-point dust of about 1e-15.
    const dust = 1e-9;
    expect(bounds.x).toBeGreaterThanOrEqual(to.x - dust);
    expect(bounds.x + bounds.w).toBeLessThanOrEqual(to.x + to.w + dust);
    expect(bounds.y).toBeGreaterThanOrEqual(to.y - dust);
    expect(bounds.y + bounds.h).toBeLessThanOrEqual(to.y + to.h + dust);
  });

  it('is the plain scaling for an upright element', () => {
    const upright = { id: 'b', type: 'rect', x: 10, y: 10, w: 10, h: 10, z: 1 } as unknown as SceneElement;
    expect(scaleRotatedInto(upright, from, to)).toMatchObject({ x: 20, w: 20, h: 10 });
  });
});
