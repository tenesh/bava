import { describe, expect, it } from 'vitest';
import { anchorFor, anchorOn, BINDING_GAP, bindingReach, elbowSnapSpots, isDetached, reroute, routeFor, targetAt } from './binding';
import type { SceneData, SceneElement } from './scene';
import { drawnPathOf, pathBounds } from './hit';

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

  // The arrow stays, the endpoint freezes,
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
  // A two-point arc is straight, so the curve is a bent one.
  it('settles an unbound arc box around its curve, keeping the points', () => {
    const data: SceneData = {
      elements: [
        { id: 'arc', type: 'arrow', x: 0, y: 0, w: 100, h: 0, z: 1, points: [0, 0, 50, -40, 100, 0], arrowType: 'arc' } as never,
      ],
    };
    reroute(data);
    const arrow = data.elements[0] as SceneElement & { points: number[] };
    const drawn = pathBounds(drawnPathOf(arrow));
    expect(arrow.y).toBeLessThanOrEqual(drawn.y);
    expect(arrow.y + arrow.h).toBeGreaterThanOrEqual(drawn.y + drawn.h);
    expect(arrow.points.filter((_, i) => i % 2 === 0)).toEqual([0, 50, 100]);
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

// Re-aiming runs after every change; a bent, anchored arrow with a placed
// label must come out of it with every key it went in with.
describe('re-aiming a bent, anchored arrow', () => {
  it('keeps its bends, anchors and label position', () => {
    const scene = {
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 40, h: 40, z: 1 },
        { id: 'b', type: 'rect', x: 200, y: 0, w: 40, h: 40, z: 2 },
        {
          id: 'arrow',
          type: 'arrow',
          x: 40,
          y: 0,
          w: 160,
          h: 80,
          z: 3,
          points: [0, 20, 80, 80, 160, 20],
          startBinding: 'a',
          endBinding: 'b',
          startAnchor: [0.5, 0.5],
          endAnchor: [0.5, 0.5],
          label: 'x',
          labelPosition: 0.25,
        },
      ],
    } as never as SceneData;
    reroute(scene);
    const arrow = scene.elements[2] as unknown as Record<string, unknown>;
    expect((arrow.points as number[]).length).toBe(6);
    expect(arrow).toMatchObject({ startAnchor: [0.5, 0.5], endAnchor: [0.5, 0.5], labelPosition: 0.25 });
  });
});

// An end aims through the spot it was dropped on, towards its neighbour, and
// stops on the outline.
describe('an end with an anchor', () => {
  const box = (over: Record<string, unknown>) => ({ type: 'rect', z: 1, ...over }) as never as SceneElement;
  const world = (arrow: SceneElement, points: number[], index: number) => [
    Math.round((arrow.x + points[index]) * 1000) / 1000,
    Math.round((arrow.y + points[index + 1]) * 1000) / 1000,
  ];

  it('aims through its anchor, so an anchor near the top moves the end up the facing side', () => {
    // a: 0..100 x 0..100; the other end is far to the right, level with a's centre.
    const arrow = {
      id: 'arrow', type: 'arrow', x: 100, y: 50, w: 400, h: 0, z: 2,
      points: [0, 0, 400, 0], startBinding: 'a', startAnchor: [0.5, 0],
    } as never as SceneElement;
    const scene = { elements: [box({ id: 'a', x: 0, y: 0, w: 100, h: 100 }), arrow] } as SceneData;
    const [x, y] = world(arrow, routeFor(arrow, scene), 0);
    // Leaves through the right side, above the centre line: the line from
    // (50, 0) to (500, 50) crosses x = 100 at y = 50 / 450 * 50.
    expect(x).toBeCloseTo(100 + BINDING_GAP, 0);
    expect(y).toBeLessThan(10);
  });

  it('aims from the centre when it has no anchor, as before', () => {
    const arrow = {
      id: 'arrow', type: 'arrow', x: 100, y: 50, w: 400, h: 0, z: 2, points: [0, 0, 400, 0], startBinding: 'a',
    } as never as SceneElement;
    const scene = { elements: [box({ id: 'a', x: 0, y: 0, w: 100, h: 100 }), arrow] } as SceneData;
    expect(world(arrow, routeFor(arrow, scene), 0)).toEqual([100 + BINDING_GAP, 50]);
  });

  it('aims at its nearest bend, not across the arrow', () => {
    // The bend is straight above a's centre; the far end is to the right.
    const arrow = {
      id: 'arrow', type: 'arrow', x: 0, y: -200, w: 400, h: 200, z: 2,
      points: [50, 200, 50, 0, 400, 50], startBinding: 'a',
    } as never as SceneElement;
    const scene = { elements: [box({ id: 'a', x: 0, y: 0, w: 100, h: 100 }), arrow] } as SceneData;
    expect(world(arrow, routeFor(arrow, scene), 0)).toEqual([50, -BINDING_GAP]);
  });

  it('turns its anchor with a rotated target', () => {
    // Turned a half turn, the anchor on the top edge's middle is on the bottom.
    const arrow = {
      id: 'arrow', type: 'arrow', x: 50, y: 50, w: 0, h: 400, z: 2,
      points: [0, 0, 0, 400], startBinding: 'a', startAnchor: [0.25, 0],
    } as never as SceneElement;
    const scene = { elements: [box({ id: 'a', x: 0, y: 0, w: 100, h: 100, angle: 180 }), arrow] } as SceneData;
    const [x, y] = world(arrow, routeFor(arrow, scene), 0);
    // (0.25, 0) turned half about (50, 50) is (75, 100): the end leaves the
    // bottom side on the line from there towards (50, 450).
    expect(y).toBeCloseTo(100 + BINDING_GAP, 0);
    expect(x).toBeGreaterThan(70);
  });
});

// As in Excalidraw, a target is found by how near its outline is, from inside
// or out, within a reach that grows as the view zooms out, rather than only by
// the pointer being strictly inside its box.
describe('finding what an end attaches to', () => {
  const shape = (over: Record<string, unknown>) => ({ type: 'rect', z: 1, ...over }) as never as SceneElement;
  const two = {
    elements: [shape({ id: 'left', x: 0, y: 0, w: 100, h: 100 }), shape({ id: 'right', x: 130, y: 0, w: 100, h: 100, z: 2 })],
  } as SceneData;

  it('finds a shape from just outside it', () => {
    expect(targetAt(two, { x: 108, y: 50 }, 'x', 15)?.id).toBe('left');
  });

  it('takes the nearer of two outlines', () => {
    expect(targetAt(two, { x: 118, y: 50 }, 'x', 15)?.id).toBe('right');
  });

  it('takes a small shape inside a big one when the point is inside both', () => {
    const nested = {
      elements: [shape({ id: 'big', x: 0, y: 0, w: 300, h: 300 }), shape({ id: 'small', x: 100, y: 100, w: 50, h: 50, z: 2 })],
    } as SceneData;
    expect(targetAt(nested, { x: 125, y: 125 }, 'x', 15)?.id).toBe('small');
  });

  it('finds nothing beyond reach', () => {
    expect(targetAt(two, { x: 50, y: 140 }, 'x', 15)).toBeUndefined();
  });

  it('does not find an ellipse from the corner of its box', () => {
    const round = { elements: [shape({ id: 'o', type: 'ellipse', x: 0, y: 0, w: 100, h: 100 })] } as SceneData;
    expect(targetAt(round, { x: 2, y: 2 }, 'x', 1)).toBeUndefined();
  });

  it('reaches further as the view zooms out, within limits', () => {
    expect(bindingReach(1)).toBe(15);
    expect(bindingReach(2)).toBe(15);
    expect(bindingReach(0.5)).toBe(20);
    expect(bindingReach(0.1)).toBe(30);
  });
});

// A spot outside the drawn outline (an ellipse's or a
// diamond's box corner) must still leave the end on its shape as it moves.
describe('an anchor near a curved or pointed shape', () => {
  const round = (over: Record<string, unknown> = {}) =>
    ({ id: 'o', type: 'ellipse', x: 0, y: 0, w: 100, h: 100, z: 1, ...over }) as never as SceneElement;

  it('is taken onto the outline when dropped by a box corner', () => {
    const [fx, fy] = anchorFor(round(), { x: 12, y: 12 }, 15);
    // On the ellipse, towards the top-left: (50 - 35.36, 50 - 35.36) / 100.
    expect(fx).toBeCloseTo(0.146, 2);
    expect(fy).toBeCloseTo(0.146, 2);
  });

  it('keeps the end on the ellipse when it moves away', () => {
    const arrow = {
      id: 'arrow', type: 'arrow', x: -200, y: -200, w: 210, h: 210, z: 2,
      points: [0, 0, 210, 210], endBinding: 'o', endAnchor: [0.12, 0.12],
    } as never as SceneElement;
    const moved = { elements: [round({ x: 50 }), arrow] } as SceneData;
    const routed = routeFor(arrow, moved);
    const end = { x: arrow.x + routed[2], y: arrow.y + routed[3] };
    // Somewhere on the moved ellipse's outline, a gap clear: not frozen at (10, 10).
    const d = Math.hypot((end.x - 100) / 50, (end.y - 50) / 50);
    expect(d).toBeGreaterThan(0.95);
    expect(d).toBeLessThan(1.15);
  });

  it('is taken onto a diamond when dropped by its box corner', () => {
    const diamond = { id: 'd', type: 'diamond', x: 0, y: 0, w: 100, h: 100, z: 1 } as never as SceneElement;
    const [fx, fy] = anchorFor(diamond, { x: 5, y: 5 }, 15);
    // The nearest point on the top-left edge, from (0,50) to (50,0).
    expect(fx + fy).toBeCloseTo(0.5, 2);
  });
});

describe('targets, snaps and kept bends', () => {
  const shape = (over: Record<string, unknown>) => ({ type: 'rect', z: 1, ...over }) as never as SceneElement;

  it('snaps to the nearest side middle, not the first within reach', () => {
    const small = shape({ id: 's', x: 0, y: 0, w: 20, h: 20 });
    expect(anchorFor(small, { x: 22, y: 8 }, 15)).toEqual([1, 0.5]);
  });

  it('finds a small shape inside a big one from just outside the small one', () => {
    const nested = {
      elements: [shape({ id: 'big', x: 0, y: 0, w: 300, h: 300 }), shape({ id: 'small', x: 100, y: 100, w: 50, h: 50, z: 2 })],
    } as SceneData;
    expect(targetAt(nested, { x: 155, y: 125 }, 'x', 15)?.id).toBe('small');
  });

  it('aims an attached elbow end to end, whatever bends it keeps', () => {
    const arrow = {
      id: 'arrow', type: 'arrow', arrowType: 'elbow', x: 100, y: -100, w: 300, h: 150, z: 2,
      points: [0, 150, 100, 0, 300, 150], startBinding: 'a',
    } as never as SceneElement;
    const scene = { elements: [shape({ id: 'a', x: 0, y: 0, w: 100, h: 100 }), arrow] } as SceneData;
    const routed = routeFor(arrow, scene);
    // Towards the far end, level with a's centre: out of the right side.
    expect([arrow.x + routed[0], arrow.y + routed[1]]).toEqual([100 + BINDING_GAP, 50]);
  });

  // Declared in docs/file-format.md: a bent attached arrow (a D2-inserted one
  // among them) aims each end at its nearest bend, which moves its ends from
  // where the old rule, aiming across the arrow, put them.
  it('aims a D2-style three-point arrow at its middle point', () => {
    const arrow = {
      id: 'arrow', type: 'arrow', x: 50, y: 100, w: 250, h: 100, z: 3,
      points: [0, 0, 0, 100, 250, 100], startBinding: 'a', endBinding: 'b',
    } as never as SceneElement;
    const scene = {
      elements: [shape({ id: 'a', x: 0, y: 0, w: 100, h: 100 }), shape({ id: 'b', x: 300, y: 150, w: 100, h: 100, z: 2 }), arrow],
    } as SceneData;
    const routed = routeFor(arrow, scene);
    expect([arrow.x + routed[0], arrow.y + routed[1]]).toEqual([50, 100 + BINDING_GAP]);
    expect([arrow.x + routed[4], arrow.y + routed[5]]).toEqual([300 - BINDING_GAP, 200]);
  });
});

// An end pinned inside a shape sits at its anchor, inside
// the shape, and moves with it; the other end aims at it.
describe('an end pinned inside a shape', () => {
  const rect = (id: string, x: number, y: number, over: Record<string, unknown> = {}) =>
    ({ id, type: 'rect', x, y, w: 100, h: 100, z: 1, ...over }) as never as SceneElement;
  const arrow = (over: Record<string, unknown>) =>
    ({ id: 'arrow', type: 'arrow', x: 0, y: 0, w: 1, h: 1, z: 3, points: [0, 0, 1, 1], ...over }) as never as SceneElement;
  const world = (element: SceneElement, points: number[], i: number) => [
    Math.round((element.x + points[i]) * 1000) / 1000,
    Math.round((element.y + points[i + 1]) * 1000) / 1000,
  ];

  it('sits at its spot inside the shape, and moves with it', () => {
    const a = arrow({ x: 25, y: 25, points: [0, 0, 400, 0], startBinding: 's', startAnchor: [0.25, 0.25], startMode: 'inside' });
    expect(world(a, routeFor(a, { elements: [rect('s', 0, 0), a] }), 0)).toEqual([25, 25]);
    expect(world(a, routeFor(a, { elements: [rect('s', 50, 10), a] }), 0)).toEqual([75, 35]);
  });

  it('is what the other end aims at', () => {
    // The start is pinned at (25, 25) in s; the end, on t to its right, aims
    // along the line from its own centre to that spot.
    const a = arrow({ x: 25, y: 25, points: [0, 0, 275, 25], startBinding: 's', startAnchor: [0.25, 0.25], startMode: 'inside', endBinding: 't' });
    const t = rect('t', 300, 0);
    const routed = routeFor(a, { elements: [rect('s', 0, 0), t, a] });
    const [x, y] = world(a, routed, 2);
    expect(x).toBeCloseTo(300 - BINDING_GAP, 0);
    expect(y).toBeLessThan(50);
  });

  it('is recorded exactly where it landed, without snapping', () => {
    expect(anchorFor(rect('s', 0, 0), { x: 3, y: 50 }, 15, true)).toEqual([0.03, 0.5]);
  });

  it('is never how an elbow end sits', () => {
    const a = arrow({ arrowType: 'elbow', x: 50, y: 50, points: [0, 0, 400, 0], startBinding: 's', startAnchor: [0.5, 0.5], startMode: 'inside' });
    const routed = routeFor(a, { elements: [rect('s', 0, 0), a] });
    expect(world(a, routed, 0)[0]).toBeGreaterThanOrEqual(100);
  });
});

describe('an Alt-pinned end outside its shape', () => {
  it('keeps its exact spot, outside the box', () => {
    const rect = { id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never as SceneElement;
    expect(anchorFor(rect, { x: -3, y: 50 }, 15, true)).toEqual([0, 0.5]);
  });
});

// An elbow end snaps to a side's middle within a band of 5% of the side
// (clamped 5 to reach), from inside or out; a diamond also to its edges' middles.
describe('where an elbow end snaps', () => {
  const rect = { id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never as SceneElement;
  const diamond = { id: 'd', type: 'diamond', x: 0, y: 0, w: 100, h: 100, z: 1 } as never as SceneElement;

  it('snaps within the band, from outside or inside', () => {
    expect(anchorFor(rect, { x: 54, y: -3 }, 15, false, true)).toEqual([0.5, 0]);
    expect(anchorFor(rect, { x: 54, y: 3 }, 15, false, true)).toEqual([0.5, 0]);
  });

  it('does not snap outside the band', () => {
    expect(anchorFor(rect, { x: 58, y: 3 }, 15, false, true)).toEqual([0.58, 0.03]);
  });

  it('snaps to a diamond edge middle', () => {
    expect(anchorFor(diamond, { x: 22, y: 21 }, 15, false, true)).toEqual([0.25, 0.25]);
  });
});

// Every spot an elbow end snaps to shows as a dot, a
// diamond's edge middles included.
describe('the spots an elbow end shows', () => {
  it("are a diamond's corners and its edge middles", () => {
    const diamond = { id: 'd', type: 'diamond', x: 0, y: 0, w: 100, h: 100, z: 1 } as never as SceneElement;
    expect(elbowSnapSpots(diamond)).toHaveLength(8);
    expect(elbowSnapSpots(diamond)).toContainEqual({ x: 25, y: 25 });
  });
});

// What an end attaches to, as Excalidraw's
// `getHoveredElementForBinding` (`element/src/collision.ts:346-478`).
describe('the shape an end attaches to', () => {
  const rect = (id: string, x: number, y: number, w: number, h: number, z: number, over: Record<string, unknown> = {}) =>
    ({ id, type: 'rect', x, y, w, h, z, ...over }) as never as SceneElement;
  const scene = (...elements: SceneElement[]): SceneData => ({ elements });

  it('is a frame from just outside it, never from inside', () => {
    const frame = { id: 'f', type: 'frame', x: 0, y: 0, w: 200, h: 200, z: 1 } as never as SceneElement;
    expect(targetAt(scene(frame), { x: -5, y: 100 }, 'arrow')?.id).toBe('f');
    expect(targetAt(scene(frame), { x: 100, y: 100 }, 'arrow')).toBeUndefined();
  });

  it('is the child under an end inside a frame', () => {
    const frame = { id: 'f', type: 'frame', x: 0, y: 0, w: 200, h: 200, z: 1 } as never as SceneElement;
    const child = rect('c', 50, 50, 50, 50, 2, { frame: 'f' });
    expect(targetAt(scene(frame, child), { x: 75, y: 75 }, 'arrow')?.id).toBe('c');
  });

  it('is the front shape containing the point, which hides the one behind', () => {
    const behind = rect('a', 60, 40, 50, 40, 1);
    const front = rect('b', 50, 50, 100, 100, 2);
    expect(targetAt(scene(behind, front), { x: 100, y: 55 }, 'arrow')?.id).toBe('b');
  });

  it('is the nearest outline, not the smallest shape, between two in reach', () => {
    const near = rect('a', 0, 0, 100, 100, 1);
    const far = rect('b', 110, 0, 50, 50, 2);
    expect(targetAt(scene(near, far), { x: 103, y: 40 }, 'arrow')?.id).toBe('a');
  });

  it('is nothing behind a locked shape, which hides without attaching', () => {
    const behind = rect('a', 0, 0, 200, 200, 1);
    const locked = rect('l', 50, 50, 100, 100, 2, { locked: true });
    expect(targetAt(scene(behind, locked), { x: 100, y: 100 }, 'arrow')).toBeUndefined();
  });

  it('prefers a smaller overlapping element that holds the point', () => {
    const container = rect('r', 0, 0, 200, 100, 1);
    const text = { id: 't', type: 'text', x: -50, y: 40, w: 100, h: 20, z: 2, text: 'x', measuredWidth: 100, measuredHeight: 20 } as never as SceneElement;
    expect(targetAt(scene(container, text), { x: 2, y: 50 }, 'arrow')?.id).toBe('t');
  });
});

// The gap is 5 plus half the target's stroke width, as
// Excalidraw's `getBindingGap` (`element/src/binding.ts:117`, `:125-131`).
describe('the gap an attached end keeps', () => {
  it('grows with the shape’s stroke width', () => {
    const thin = { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 60, z: 1 } as never as SceneElement;
    const thick = { ...(thin as object), strokeWidth: 4 } as never as SceneElement;
    expect(anchorOn(thin, { x: 300, y: 30 }).x).toBe(106);
    expect(anchorOn(thick, { x: 300, y: 30 }).x).toBe(107);
    expect(BINDING_GAP).toBe(6);
  });
});

// An end attached at the edge is stored as the drop point carried
// onto the shape's nearer diagonal (centre lines for a curved shape), along
// the line from the arrow's other end (`projectFixedPointOntoDiagonal`,
// `element/src/utils.ts:810-903`).
describe('where an edge anchor is stored', () => {
  const box = { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never as SceneElement;
  const ellipse = { ...(box as object), type: 'ellipse' } as never as SceneElement;

  it('is on the diagonal nearer the other end', () => {
    const [fx, fy] = anchorFor(box, { x: 104, y: 20 }, 15, false, false, { x: 300, y: 50 });
    expect(fx).toBeCloseTo(0.832, 2);
    expect(fy).toBeCloseTo(0.168, 2);
  });

  it('is on a centre line for a curved shape', () => {
    const [fx, fy] = anchorFor(ellipse, { x: 104, y: 20 }, 15, false, false, { x: 300, y: 50 });
    expect(fx).toBeCloseTo(0.5, 2);
    expect(fy).toBeLessThan(0.2);
  });

  it('snaps to a side middle first, and falls back without another end', () => {
    expect(anchorFor(box, { x: 104, y: 50 }, 15, false, false, { x: 300, y: 50 })).toEqual([1, 0.5]);
    expect(anchorFor(box, { x: 104, y: 20 }, 15)).toEqual([1, 0.2]);
  });
});

// An arrow never turns inside out: an end whose outline point is
// inside the other, overlapping shape, or an arrow under 10 long, sits at its
// anchor instead (`element/src/binding.ts:2037-2094`).
describe('an arrow between overlapping shapes', () => {
  it('ends at its anchor when its outline point is inside the other shape', () => {
    const data: SceneData = {
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never,
        { id: 'b', type: 'rect', x: 60, y: 0, w: 100, h: 100, z: 2 } as never,
        { id: 'r', type: 'arrow', x: 30, y: 50, w: 100, h: 0, z: 3, points: [0, 0, 100, 0], startBinding: 'a', startAnchor: [0.3, 0.5], endBinding: 'b', endAnchor: [0.7, 0.5] } as never,
      ],
    };
    const route = routeFor(data.elements[2], data);
    const arrow = data.elements[2] as unknown as { x: number; y: number };
    // A's right edge (106 out) lies inside B: the start sits at A's anchor, (30, 50).
    expect([arrow.x + route[0], arrow.y + route[1]]).toEqual([30, 50]);
  });
});

// The inside-out guard applies only between shapes of like
// size (Excalidraw's area test), so a child's arrow to its container still
// leaves the child's edge.
describe('an arrow from a child to its container', () => {
  it('leaves the child from its edge', () => {
    const data: SceneData = {
      elements: [
        { id: 'big', type: 'rect', x: 0, y: 0, w: 400, h: 400, z: 1 } as never,
        { id: 'small', type: 'rect', x: 50, y: 50, w: 60, h: 60, z: 2 } as never,
        { id: 'r', type: 'arrow', x: 80, y: 80, w: 300, h: 0, z: 3, points: [0, 0, 300, 0], startBinding: 'small', startAnchor: [0.5, 0.5], endBinding: 'big', endAnchor: [1, 0.2] } as never,
      ],
    };
    const route = routeFor(data.elements[2], data);
    const arrow = data.elements[2] as unknown as { x: number };
    expect(arrow.x + route[0]).toBeGreaterThan(110);
  });
});
