import { describe, expect, it } from 'vitest';
import { reroute } from './binding';
import { createHistory } from './history';
import { setProperty } from './style';
import { pathOf } from './arrows';
import type { SceneData, SceneElement } from './scene';

// Decision 2 of 06.12 and .claude/work/specs/excalidraw-elbow-routing.md: an
// elbow keeps the side each end was dropped on and routes around the shapes,
// and its route is stored in its points (decision 5).
const box = (id: string, x: number, y: number, w = 100, h = 60) =>
  ({ id, type: 'rect', x, y, w, h, z: 1 }) as unknown as SceneElement;

function routed(scene: SceneData): number[] {
  reroute(scene);
  const arrow = scene.elements.find((e) => e.type === 'arrow') as unknown as { x: number; y: number; points: number[] };
  return arrow.points.map((v, i) => Math.round((v + (i % 2 === 0 ? arrow.x : arrow.y)) * 10) / 10);
}

const elbow = (over: Record<string, unknown>) =>
  ({ id: 'e', type: 'arrow', arrowType: 'elbow', x: 0, y: 0, w: 1, h: 1, z: 9, points: [0, 0, 1, 1], ...over }) as unknown as SceneElement;

/** Whether a segment runs through a box's interior. */
function crosses(x1: number, y1: number, x2: number, y2: number, b: { x: number; y: number; w: number; h: number }): boolean {
  const steps = 50;
  for (let i = 1; i < steps; i += 1) {
    const x = x1 + ((x2 - x1) * i) / steps;
    const y = y1 + ((y2 - y1) * i) / steps;
    if (x > b.x + 0.5 && x < b.x + b.w - 0.5 && y > b.y + 0.5 && y < b.y + b.h - 0.5) return true;
  }
  return false;
}

function segments(points: number[]): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i + 3 < points.length; i += 2) out.push([points[i], points[i + 1], points[i + 2], points[i + 3]]);
  return out;
}

describe('an elbow arrow', () => {
  // The user's case: A above B, from A's top to B's bottom.
  it('leaves A upwards, goes round, and enters B from below', () => {
    const a = box('a', 0, 0);
    const b = box('b', 0, 200);
    const points = routed({
      elements: [a, b, elbow({ points: [50, 0, 50, 260], startBinding: 'a', startAnchor: [0.5, 0], endBinding: 'b', endAnchor: [0.5, 1] })],
    });
    // First leg goes up from A's top; last leg comes up into B's bottom.
    expect(points[1]).toBeLessThanOrEqual(0);
    expect(points[3]).toBeLessThan(points[1]);
    expect(points.at(-1)).toBeGreaterThanOrEqual(260);
    expect(points.at(-3)).toBeGreaterThan(points.at(-1)!);
    for (const [x1, y1, x2, y2] of segments(points)) {
      expect(crosses(x1, y1, x2, y2, a)).toBe(false);
      expect(crosses(x1, y1, x2, y2, b)).toBe(false);
      expect(x1 === x2 || y1 === y2).toBe(true);
    }
  });

  it('runs straight between facing sides', () => {
    const points = routed({
      elements: [
        box('a', 0, 0),
        box('b', 300, 0),
        elbow({ points: [100, 30, 300, 30], startBinding: 'a', startAnchor: [1, 0.5], endBinding: 'b', endAnchor: [0, 0.5] }),
      ],
    });
    expect(points).toHaveLength(4);
    expect(points[1]).toBe(points[3]);
  });

  it('never runs through either shape', () => {
    const a = box('a', 0, 0);
    const b = box('b', 150, 150);
    const points = routed({
      elements: [a, b, elbow({ points: [0, 30, 250, 180], startBinding: 'a', startAnchor: [0, 0.5], endBinding: 'b', endAnchor: [1, 0.5] })],
    });
    for (const [x1, y1, x2, y2] of segments(points)) {
      expect(crosses(x1, y1, x2, y2, a)).toBe(false);
      expect(crosses(x1, y1, x2, y2, b)).toBe(false);
    }
  });

  it('runs as right angles between two free ends', () => {
    const points = routed({ elements: [elbow({ points: [0, 0, 200, 100] })] });
    expect(points.slice(0, 2)).toEqual([0, 0]);
    expect(points.slice(-2)).toEqual([200, 100]);
    for (const [x1, y1, x2, y2] of segments(points)) expect(x1 === x2 || y1 === y2).toBe(true);
    expect(points.length).toBeGreaterThan(4);
  });

  it('is routed again when a shape moves', () => {
    const scene: SceneData = {
      elements: [
        box('a', 0, 0),
        box('b', 300, 0),
        elbow({ points: [100, 30, 300, 30], startBinding: 'a', startAnchor: [1, 0.5], endBinding: 'b', endAnchor: [0, 0.5] }),
      ],
    };
    routed(scene);
    (scene.elements[1] as { y: number }).y = 200;
    const points = routed(scene);
    expect(points.at(-1)).toBe(230);
    expect(points.length).toBeGreaterThan(4);
  });

  it('is routed when a file with a two-point elbow is opened', () => {
    const history = createHistory({ elements: [] });
    history.reset({
      elements: [box('a', 0, 0), box('b', 0, 200), elbow({ points: [50, 0, 50, 260], startBinding: 'a', startAnchor: [0.5, 0], endBinding: 'b', endAnchor: [0.5, 1] })],
    });
    const arrow = history.current.elements[2] as unknown as { points: number[] };
    expect(arrow.points.length).toBeGreaterThan(4);
  });
});

// Decision 5: switching to elbow replaces bends with the route; switching away
// keeps only the ends.
describe('switching an arrow to and from elbow', () => {
  it('keeps only its ends when it stops being an elbow', () => {
    const history = createHistory({ elements: [elbow({ points: [0, 0, 100, 0, 100, 100, 200, 100], w: 200, h: 100 })] });
    setProperty(history, ['e'], 'arrowType', 'straight');
    const arrow = history.current.elements[0] as unknown as { x: number; y: number; points: number[] };
    expect(arrow.points.map((v, i) => v + (i % 2 === 0 ? arrow.x : arrow.y))).toEqual([0, 0, 200, 100]);
  });
});

// Review of 06.12: shapes that overlap, touch or nearly touch, both ends on
// one shape, and a turned shape.
describe('an elbow between awkward shapes', () => {
  const rect = (id: string, x: number, y: number, w = 100, h = 60, over: Record<string, unknown> = {}) =>
    ({ id, type: 'rect', x, y, w, h, z: 1, ...over }) as unknown as SceneElement;

  it('goes round a shape when both ends are on it', () => {
    const a = rect('a', 0, 0);
    const points = routed({ elements: [a, elbow({ points: [50, 0, 50, 60], startBinding: 'a', startAnchor: [0.5, 0], endBinding: 'a', endAnchor: [0.5, 1] })] });
    for (const [x1, y1, x2, y2] of segments(points)) expect(crosses(x1, y1, x2, y2, a)).toBe(false);
    expect(points.length).toBeGreaterThan(4);
  });

  it('goes round shapes that overlap', () => {
    const a = rect('a', 0, 0);
    const b = rect('b', 50, 30);
    const points = routed({ elements: [a, b, elbow({ points: [50, 0, 100, 90], startBinding: 'a', startAnchor: [0.5, 0], endBinding: 'b', endAnchor: [0.5, 1] })] });
    for (const [x1, y1, x2, y2] of segments(points)) {
      expect(crosses(x1, y1, x2, y2, a)).toBe(false);
      expect(crosses(x1, y1, x2, y2, b)).toBe(false);
    }
  });

  it('routes between shapes that touch, and ones 6 apart', () => {
    for (const gap of [0, 6]) {
      const a = rect('a', 0, 0);
      const b = rect('b', 100 + gap, 100);
      const points = routed({ elements: [a, b, elbow({ points: [50, 0, 150, 160], startBinding: 'a', startAnchor: [0.5, 0], endBinding: 'b', endAnchor: [0.5, 1] })] });
      for (const [x1, y1, x2, y2] of segments(points)) {
        expect(crosses(x1, y1, x2, y2, a)).toBe(false);
        expect(crosses(x1, y1, x2, y2, b)).toBe(false);
        expect(x1 === x2 || y1 === y2).toBe(true);
      }
    }
  });

  it('leaves a turned shape from the side it was attached on, as drawn', () => {
    // Turned a quarter: the local top edge faces right on screen.
    const a = rect('a', 0, 0, 100, 60, { angle: 90 });
    const points = routed({ elements: [a, elbow({ points: [80, 30, 300, 30], startBinding: 'a', startAnchor: [0.5, 0] })] });
    // The shape's drawn right edge is at x = 50 + 30 = 80: the end sits just
    // outside it, level with the centre, and the route leaves rightward.
    expect(points[0]).toBeGreaterThan(80);
    expect(points[1]).toBeCloseTo(30, 0);
    expect(points[2]).toBeGreaterThan(points[0]);
  });
});

describe('switching an arrow to elbow', () => {
  it('replaces its bends with the route', () => {
    const history = createHistory({
      elements: [
        box('a', 0, 0),
        box('b', 300, 0),
        { id: 'e', type: 'arrow', x: 100, y: 0, w: 200, h: 100, z: 9, points: [0, 30, 100, 100, 200, 30], startBinding: 'a', startAnchor: [1, 0.5], endBinding: 'b', endAnchor: [0, 0.5] } as never,
      ],
    });
    setProperty(history, ['e'], 'arrowType', 'elbow');
    const arrow = history.current.elements[2] as unknown as { x: number; y: number; points: number[] };
    const world = arrow.points.map((v, i) => v + (i % 2 === 0 ? arrow.x : arrow.y));
    expect(world).toHaveLength(4);
    expect(world[1]).toBe(world[3]);
  });
});

describe('switching a pinned arrow to elbow', () => {
  it('drops the pins: an elbow end is never inside', () => {
    const history = createHistory({
      elements: [box('a', 0, 0), { id: 'e', type: 'arrow', x: 50, y: 30, w: 200, h: 0, z: 9, points: [0, 0, 200, 0], startBinding: 'a', startAnchor: [0.5, 0.5], startMode: 'inside' } as never],
    });
    setProperty(history, ['e'], 'arrowType', 'elbow');
    expect(history.current.elements[1]).not.toHaveProperty('startMode');
  });
});

// 06.14, inventory section 4: the shape of an elbow's route, as Excalidraw's.
describe('an elbow shaped as Excalidraw draws it', () => {
  // E2: Excalidraw grows the shape by 10 on its heading side (30 with a
  // head) and pads by 40 less that, so a route keeps 40 clear on every side,
  // head or not (`elbowArrow.ts:1308-1394`).
  it('keeps 40 clear of the shape it leaves', () => {
    const points = routed({
      elements: [
        box('a', 0, 0),
        box('b', 400, 0),
        elbow({ points: [50, 0, 450, 0], startBinding: 'a', startAnchor: [0.5, 0], endBinding: 'b', endAnchor: [0.5, 0] }),
      ],
    });
    // The top leg runs at the start's dongle, 40 above A.
    expect(Math.min(...points.filter((_, i) => i % 2 === 1))).toBe(-40);
  });

  // E6: an end at a box corner leaves by a side, never along the edge.
  it('leaves a corner anchor outward, not along the edge', () => {
    const points = routed({
      elements: [box('a', 0, 0), elbow({ points: [0, 0, 400, 300], startBinding: 'a', startAnchor: [0, 0] })],
    });
    const [x1, y1, x2, y2] = points;
    // The first leg does not run along the top edge (y = 0) across the box.
    expect(y1 === y2 && y1 === 0 && x2 > 0).toBe(false);
    expect(x1 === x2 || y1 === y2).toBe(true);
  });
});

describe('elbow corners', () => {
  // E4: each corner drawn as a curve of radius min(16, half each neighbour).
  it('are rounded when drawn, the stored route kept square', () => {
    const route = [0, 0, 100, 0, 100, 100];
    const drawn = pathOf(route, 'elbow');
    expect(route).toEqual([0, 0, 100, 0, 100, 100]);
    // The corner itself is cut: the drawn path turns within 16 of it.
    const hitsCorner = drawn.some((v, i) => i % 2 === 0 && v === 100 && drawn[i + 1] === 0);
    expect(hitsCorner).toBe(false);
    expect(drawn.slice(0, 2)).toEqual([0, 0]);
    expect(drawn.slice(-2)).toEqual([100, 100]);
    expect(drawn).toContain(84);
  });

  it('use a smaller radius on a short segment', () => {
    const drawn = pathOf([0, 0, 10, 0, 10, 100], 'elbow');
    // Half of the 10-long first segment: the curve starts at x = 5.
    expect(drawn.slice(2, 4)).toEqual([5, 0]);
  });
});

// 06.14 E11: a dragged (fixed) segment stays where it was put when a shape
// moves; only the legs at the ends adapt.
describe('an elbow with a fixed segment', () => {
  const scene = (bY = 200): SceneData => ({
    elements: [
      box('a', 0, 0, 100, 100),
      box('b', 300, bY, 100, 100),
      elbow({
        x: 104,
        y: 50,
        points: [0, 0, 126, 0, 126, 200, 192, 200],
        startBinding: 'a',
        startAnchor: [1, 0.5],
        endBinding: 'b',
        endAnchor: [0, 0.5],
        fixedSegments: [{ index: 2, start: [126, 0], end: [126, 200] }],
      }),
    ],
  });

  it('keeps it when a shape moves', () => {
    expect(routed(scene(230))).toEqual([104, 50, 230, 50, 230, 280, 296, 280]);
  });

  it('keeps its record in step with the points', () => {
    const moved = scene(230);
    reroute(moved);
    const arrow = moved.elements[2] as unknown as { points: number[]; fixedSegments: { index: number; start: number[]; end: number[] }[] };
    expect(arrow.fixedSegments).toEqual([{ index: 2, start: arrow.points.slice(2, 4), end: arrow.points.slice(4, 6) }]);
  });

  // Review of 06.14: the stub pair shifts the indices; the kept segment
  // must be checked against the new route, not the old one.
  it('keeps it when the start moves to a side that needs a stub', () => {
    const moved = scene();
    (moved.elements[2] as unknown as { startAnchor: number[] }).startAnchor = [0.5, 0];
    reroute(moved);
    const arrow = moved.elements[2] as unknown as { x: number; points: number[]; fixedSegments?: { index: number }[] };
    expect(arrow.fixedSegments?.map((f) => f.index)).toEqual([3]);
    expect(arrow.x + arrow.points[6]).toBe(230);
  });

  it('routes whole again once no fixed segment is left', () => {
    const plain = scene(230);
    delete (plain.elements[2] as { fixedSegments?: unknown }).fixedSegments;
    expect(routed(plain)).not.toEqual([104, 50, 230, 50, 230, 280, 296, 280]);
  });
});

// 06.14 E14, E15: switching kinds as Excalidraw does
// (`actionProperties.tsx:2077-2221`).
describe('switching kinds, as Excalidraw does', () => {
  it('to elbow: two points, its turn and its fixed segments gone', () => {
    const history = createHistory({
      elements: [{ id: 'e', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 9, angle: 90, points: [0, 0, 100, 40, 200, 0] } as never],
    });
    setProperty(history, ['e'], 'arrowType', 'elbow');
    const arrow = history.current.elements[0] as unknown as { angle?: number; x: number; y: number; points: number[] };
    expect(arrow.angle ?? 0).toBe(0);
  });

  it('to elbow: each end re-attached by the elbow snap', () => {
    const history = createHistory({
      elements: [
        box('a', 0, 0, 100, 60),
        { id: 'e', type: 'arrow', x: 104, y: 31, w: 200, h: 0, z: 9, points: [0, 0, 200, 0], startBinding: 'a', startAnchor: [1, 0.52] } as never,
      ],
    });
    setProperty(history, ['e'], 'arrowType', 'elbow');
    expect(history.current.elements[1]).toMatchObject({ startAnchor: [1, 0.5] });
  });

  it('away from elbow: its fixed segments dropped', () => {
    const history = createHistory({
      elements: [
        elbow({
          points: [0, 0, 100, 0, 100, 100, 200, 100],
          w: 200,
          h: 100,
          fixedSegments: [{ index: 2, start: [100, 0], end: [100, 100] }],
        }),
      ],
    });
    setProperty(history, ['e'], 'arrowType', 'straight');
    expect(history.current.elements[0]).not.toHaveProperty('fixedSegments');
  });
});
