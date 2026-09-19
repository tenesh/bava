import { describe, expect, it } from 'vitest';
import { anchorOn, BINDING_GAP, isDetached, reroute, routeFor } from './binding';
import type { SceneData, SceneElement } from './scene';

const el = (over: Record<string, unknown>): SceneElement =>
  ({ id: 'e', type: 'rect', x: 0, y: 0, w: 100, h: 60, z: 1, ...over }) as SceneElement;

const close = (value: number) => Math.round(value * 1000) / 1000;
const at = (point: { x: number; y: number }) => [close(point.x), close(point.y)];

describe('where an arrow touches a shape', () => {
  const box = el({ x: 0, y: 0, w: 100, h: 60 });

  // Aim at the centre, stop at the outline, a gap clear of it: the rule the
  // user picked, and what Excalidraw and Eraser do.
  it('meets the edge facing the other end, with the gap', () => {
    // From the right: the anchor is on the right edge, at the centre height.
    expect(at(anchorOn(box, { x: 300, y: 30 }))).toEqual([100 + BINDING_GAP, 30]);
    // From below: the bottom edge.
    expect(at(anchorOn(box, { x: 50, y: 300 }))).toEqual([50, 60 + BINDING_GAP]);
  });

  it('re-aims when the other end moves', () => {
    const right = anchorOn(box, { x: 300, y: 30 });
    const below = anchorOn(box, { x: 50, y: 300 });
    expect(at(right)).not.toEqual(at(below));
  });

  // An ellipse is not its box: an arrow coming in diagonally must not stop at
  // the corner of a rectangle that is not drawn.
  it('follows an ellipse curve, not its box corner', () => {
    const ellipse = el({ type: 'ellipse', w: 100, h: 100 });
    const anchor = anchorOn(ellipse, { x: 200, y: 200 });
    const centre = { x: 50, y: 50 };
    const radius = Math.hypot(anchor.x - centre.x, anchor.y - centre.y);
    expect(close(radius)).toBe(close(50 + BINDING_GAP));
  });

  it('follows a rotated shape where it is drawn', () => {
    const upright = anchorOn(el({ w: 100, h: 20 }), { x: 50, y: 300 });
    const turned = anchorOn(el({ w: 100, h: 20, angle: 90 }), { x: 50, y: 300 });
    // Turned a quarter, the bar is 20 wide and 100 tall: its bottom edge is
    // further down than the upright one's.
    expect(turned.y).toBeGreaterThan(upright.y);
  });

  // A point at the centre gives no direction to leave by. The anchor is then
  // the centre itself, and `routeFor` declines to use it rather than
  // collapsing the arrow onto that point.
  it('falls back to the centre for a point with no direction', () => {
    expect(anchorOn(box, { x: 50, y: 30 })).toEqual({ x: 50, y: 30 });
  });

  it('anchors on the outline for any other point inside the shape', () => {
    const anchor = anchorOn(box, { x: 60, y: 30 });
    expect(anchor.x).toBe(100 + BINDING_GAP);
  });
});

describe('routing an attached arrow', () => {
  const scene = (): SceneData => ({
    elements: [
      el({ id: 'a', x: 0, y: 0, w: 100, h: 60 }),
      el({ id: 'b', x: 300, y: 0, w: 100, h: 60 }),
      {
        id: 'arrow',
        type: 'arrow',
        x: 100,
        y: 30,
        w: 200,
        h: 0,
        z: 3,
        points: [0, 0, 200, 0],
        startBinding: 'a',
        endBinding: 'b',
      } as never,
    ],
  });

  // Points are stored relative to the arrow's own x, y, as the file holds
  // them, so the test converts rather than the function changing frame.
  const inScene = (arrow: SceneElement, routed: number[], index: number) =>
    at({ x: arrow.x + routed[index], y: arrow.y + routed[index + 1] });

  it('puts each end on its target', () => {
    const arrow = scene().elements[2];
    const routed = routeFor(arrow, scene());
    expect(inScene(arrow, routed, 0)).toEqual([100 + BINDING_GAP, 30]);
    expect(inScene(arrow, routed, 2)).toEqual([300 - BINDING_GAP, 30]);
  });

  it('routes only the bound end, leaving the free one where it was drawn', () => {
    const data = scene();
    const arrow = { ...data.elements[2], endBinding: undefined } as SceneElement;
    const routed = routeFor(arrow, data);
    expect(inScene(arrow, routed, 2)).toEqual([300, 30]);
  });

  // The rule of canvas-architecture.md: the arrow stays, the endpoint freezes,
  // and the binding is kept with the id it had.
  it('freezes an end whose target is gone, and says it is detached', () => {
    const data = scene();
    data.elements = data.elements.filter((e) => e.id !== 'b');
    const arrow = data.elements[1];
    const routed = routeFor(arrow, data);
    expect(inScene(arrow, routed, 2)).toEqual([300, 30]);
    expect(isDetached(arrow, data)).toBe(true);
    expect((arrow as { endBinding?: string }).endBinding).toBe('b');
  });

  it('is not detached while both targets are there', () => {
    const data = scene();
    expect(isDetached(data.elements[2], data)).toBe(false);
  });

  it('leaves an unbound arrow exactly as it was drawn', () => {
    const data = scene();
    const plain = { ...data.elements[2], startBinding: undefined, endBinding: undefined } as SceneElement;
    expect(routeFor(plain, data)).toEqual([0, 0, 200, 0]);
  });
});


// Re-routing is one pass over the scene, applied after any change, so no edit
// path can forget it: a drag, a resize, a rotation, an align, a nudge or an
// undo all end here.
describe('re-routing after a change', () => {
  const scene = (): SceneData => ({
    elements: [
      el({ id: 'a', x: 0, y: 0, w: 100, h: 60 }),
      el({ id: 'b', x: 300, y: 0, w: 100, h: 60 }),
      {
        id: 'arrow',
        type: 'arrow',
        x: 0,
        y: 0,
        w: 200,
        h: 0,
        z: 3,
        points: [100, 30, 300, 30],
        startBinding: 'a',
        endBinding: 'b',
      } as never,
    ],
  });

  it('moves the ends of every bound arrow, and nothing else', () => {
    const data = scene();
    data.elements[1] = { ...data.elements[1], x: 300, y: 400 } as SceneElement;
    reroute(data);
    const arrow = data.elements[2] as SceneElement & { points: number[] };
    // The far end now aims down at b, so it has left the horizontal line.
    expect(arrow.points[3]).toBeGreaterThan(30);
    expect(data.elements[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('keeps the arrow box around the points it draws', () => {
    const data = scene();
    data.elements[1] = { ...data.elements[1], x: 300, y: 400 } as SceneElement;
    reroute(data);
    const arrow = data.elements[2] as SceneElement & { points: number[] };
    const xs = arrow.points.filter((_, i) => i % 2 === 0);
    const ys = arrow.points.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(arrow.w).toBeGreaterThanOrEqual(Math.max(...xs) - Math.min(...xs));
    expect(arrow.h).toBeGreaterThanOrEqual(Math.max(...ys) - Math.min(...ys));
  });

  it('leaves a scene with no arrows untouched', () => {
    const data: SceneData = { elements: [el({ id: 'a' })] };
    const before = JSON.stringify(data);
    reroute(data);
    expect(JSON.stringify(data)).toBe(before);
  });

  // An unbound arrow keeps its points, but its box is still settled around
  // what it draws: that is how an arc's bow gets inside its own bounds, which
  // selection, the marquee, the eraser and the export all test.
  it('settles an unbound arc box around its bow, keeping the points', () => {
    const data: SceneData = {
      elements: [
        { id: 'arc', type: 'arrow', x: 0, y: 0, w: 100, h: 0, z: 1, points: [0, 0, 100, 0], arrowType: 'arc' } as never,
      ],
    };
    reroute(data);
    const arrow = data.elements[0] as SceneElement & { points: number[] };
    expect(arrow.h).toBeGreaterThan(0);
    expect(arrow.points[0]).toBe(0);
    expect(arrow.points[2]).toBe(100);
  });
});

// An attached arrow's direction is derived from the shapes it joins, so a
// stored angle has nothing left to mean: it would turn the arrow away from
// the anchors that were just computed for it.
describe('a rotated arrow that gets attached', () => {
  const scene = (): SceneData => ({
    elements: [
      el({ id: 'a', x: 0, y: 0, w: 60, h: 60 }),
      el({ id: 'b', x: 300, y: 0, w: 60, h: 60 }),
      {
        id: 'arrow',
        type: 'arrow',
        x: 60,
        y: 30,
        w: 240,
        h: 0,
        z: 3,
        points: [0, 0, 240, 0],
        angle: 45,
        startBinding: 'a',
        endBinding: 'b',
      } as never,
    ],
  });

  it('loses the angle, so its ends stay on the shapes', () => {
    const data = scene();
    reroute(data);
    const arrow = data.elements[2] as SceneElement & { angle?: number; points: number[] };
    expect(arrow.angle).toBeUndefined();
    // Both ends sit between the two shapes, level with their centres.
    expect(arrow.y + arrow.points[1]).toBe(30);
    expect(arrow.y + arrow.points[3]).toBe(30);
  });

  it('leaves an unattached arrow its angle', () => {
    const data = scene();
    const free = { ...data.elements[2], startBinding: undefined, endBinding: undefined } as SceneElement;
    data.elements[2] = free;
    reroute(data);
    expect((data.elements[2] as { angle?: number }).angle).toBe(45);
  });
});
