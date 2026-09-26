import { describe, expect, it } from 'vitest';
import { drawHead, headDash, labelSpot, labelWrapWidth, headAt, routePoints, labelPoint, positionAlong } from './arrows';

const from = [0, 0, 100, 60];

describe('routePoints', () => {
  it('leaves a straight arrow as it was drawn', () => {
    expect(routePoints(from, 'straight')).toEqual(from);
    expect(routePoints(from, undefined)).toEqual(from);
  });

  it('routes an elbow as orthogonal segments between the same ends', () => {
    const points = routePoints(from, 'elbow');
    expect(points.slice(0, 2)).toEqual([0, 0]);
    expect(points.slice(-2)).toEqual([100, 60]);
    for (let i = 0; i + 3 < points.length; i += 2) {
      const horizontal = points[i + 1] === points[i + 3];
      const vertical = points[i] === points[i + 2];
      expect(horizontal || vertical, `segment ${i / 2} is diagonal`).toBe(true);
    }
  });

  it('turns along the longer axis first', () => {
    // Wider than tall: go across, then down.
    expect(routePoints([0, 0, 100, 20], 'elbow')).toEqual([0, 0, 50, 0, 50, 20, 100, 20]);
    // Taller than wide: go down, then across.
    expect(routePoints([0, 0, 20, 100], 'elbow')).toEqual([0, 0, 0, 50, 20, 50, 20, 100]);
  });

  // 06.15 V2, replacing "bows an arc to one side": a curve through two points
  // is straight, as Excalidraw's (`element/src/shape.ts:934-935`).
  it('draws a two-point arc straight', () => {
    expect(routePoints(from, 'arc')).toEqual(from);
  });

  // Many points no longer means "a stroke": an arrow's bends are points too,
  // and the kind decides how they are drawn (see 'routing through bends').
  // A stroke never has a kind, so it is still drawn as recorded.
  it('leaves many points alone when there is no kind', () => {
    const many = [0, 0, 10, 10, 20, 0, 30, 10];
    expect(routePoints(many, undefined)).toEqual(many);
  });
});

// 06.16 H1 to H5: heads as Excalidraw draws them (`element/src/bounds.ts:710-845`,
// `element/src/shape.ts:290-575`), tip at the origin, pointing along +x.
describe('arrowhead shapes', () => {
  const sink = () => {
    const calls: string[] = [];
    const points: [number, number][] = [];
    return {
      calls,
      points,
      moveTo: (x: number, y: number) => (calls.push('moveTo'), points.push([x, y])),
      lineTo: (x: number, y: number) => (calls.push('lineTo'), points.push([x, y])),
      bezierCurveTo: (_a: number, _b: number, _c: number, _d: number, x: number, y: number) => (calls.push('curve'), points.push([x, y])),
      closePath: () => calls.push('close'),
    };
  };
  const reach = (s: ReturnType<typeof sink>) => Math.round(-Math.min(...s.points.map(([x]) => x)));
  const long = 200;

  it('draws nothing for none', () => {
    const s = sink();
    expect(drawHead(s, 'none', long, 2)).toBe('none');
    expect(s.calls).toEqual([]);
  });

  it('sizes each kind as Excalidraw does', () => {
    const size = (kind: string) => {
      const s = sink();
      drawHead(s, kind, long, 2);
      return reach(s);
    };
    // The arrow's barbs reach 25 back at 20°; a diamond is twice its 12.
    expect(size('arrow')).toBe(Math.round(25 * Math.cos((20 * Math.PI) / 180)));
    expect(size('triangle')).toBe(Math.round(15 * Math.cos((25 * Math.PI) / 180)));
    expect(size('diamond')).toBe(24);
  });

  it('shrinks on a short last segment: half of it, a quarter for a diamond', () => {
    const s = sink();
    drawHead(s, 'arrow', 20, 2);
    expect(reach(s)).toBe(Math.round(10 * Math.cos((20 * Math.PI) / 180)));
    const d = sink();
    drawHead(d, 'diamond', 20, 2);
    expect(reach(d)).toBe(10);
  });

  it('grows a circle with the stroke width', () => {
    const thin = sink();
    drawHead(thin, 'circle', long, 2);
    const thick = sink();
    drawHead(thick, 'circle', long, 4);
    const span = (s: ReturnType<typeof sink>) => Math.max(...s.points.map(([x]) => x)) - Math.min(...s.points.map(([x]) => x));
    expect(span(thick) - span(thin)).toBeCloseTo(2, 5);
  });

  it('fills solid heads with the line colour and outline heads with the canvas', () => {
    expect(drawHead(sink(), 'triangle', long, 2)).toBe('stroke');
    expect(drawHead(sink(), 'triangle-outline', long, 2)).toBe('surface');
    expect(drawHead(sink(), 'circle-outline', long, 2)).toBe('surface');
    expect(drawHead(sink(), 'diamond', long, 2)).toBe('stroke');
    expect(drawHead(sink(), 'arrow', long, 2)).toBe('none');
    expect(drawHead(sink(), 'zeroOrMany', long, 2)).toBe('surface');
  });

  it("draws the crow's-foot heads", () => {
    for (const kind of ['one', 'many', 'oneOrMany', 'exactlyOne', 'zeroOrOne', 'zeroOrMany']) {
      const s = sink();
      drawHead(s, kind, long, 2);
      expect(s.calls.length, kind).toBeGreaterThan(0);
    }
    // Many spreads towards the tip from 15 back.
    const many = sink();
    drawHead(many, 'many', long, 2);
    expect(reach(many)).toBe(15);
  });

  it('draws an unknown head as the default arrow', () => {
    const known = sink();
    drawHead(known, 'arrow', long, 2);
    const unknown = sink();
    drawHead(unknown, 'sparkle', long, 2);
    expect(unknown.points).toEqual(known.points);
  });
});

describe('where a head points', () => {
  it('is the angle of the last segment, at its end', () => {
    expect(headAt([0, 0, 10, 0], 'end')).toMatchObject({ x: 10, y: 0, angle: 0 });
    expect(headAt([0, 0, 0, 10], 'end')).toMatchObject({ x: 0, y: 10, angle: 90 });
    // The start head points back along the first segment.
    expect(headAt([0, 0, 10, 0], 'start')).toMatchObject({ x: 0, y: 0, angle: 180 });
  });
});

// A label sits at the middle of the path the arrow actually takes, so it
// stays on the line when the arrow is an elbow or an arc.
describe('where an arrow label sits', () => {
  it('is the midpoint of a straight run', () => {
    expect(labelPoint([0, 0, 100, 0])).toEqual({ x: 50, y: 0 });
  });

  it('follows the path, not the straight line between the ends', () => {
    // An elbow out, across and in: its middle is on the crossing segment.
    const elbow = routePoints([0, 0, 100, 60], 'elbow');
    const at = labelPoint(elbow);
    expect(at.x).toBe(50);
    expect(at.y).toBeGreaterThan(0);
    expect(at.y).toBeLessThan(60);
  });

  it('is the single point of a degenerate arrow', () => {
    expect(labelPoint([7, 9])).toEqual({ x: 7, y: 9 });
  });
});

// Bends are points; the kind decides how they are drawn (docs/file-format.md,
// "The kind decides how bends are drawn").
describe('routing through bends', () => {
  const bent = [0, 0, 50, 100, 100, 0];

  it('draws a straight arrow through its bend with a corner', () => {
    expect(routePoints(bent, 'straight')).toEqual(bent);
    expect(routePoints(bent, undefined)).toEqual(bent);
  });

  it('curves an arc smoothly through its bend', () => {
    const path = routePoints(bent, 'arc');
    expect(path.length).toBeGreaterThan(bent.length);
    // Through the bend, and from end to end.
    const passes = path.some((v, i) => i % 2 === 0 && Math.abs(v - 50) < 1e-6 && Math.abs(path[i + 1] - 100) < 1e-6);
    expect(passes).toBe(true);
    expect(path.slice(0, 2)).toEqual([0, 0]);
    expect(path.slice(-2)).toEqual([100, 0]);
  });

  // An elbow's points are its stored route (06.12, `elbow.ts`): drawn as they are.
  it('draws an elbow\'s stored route as it is', () => {
    const route = [0, 0, 50, 0, 50, 100, 100, 100];
    expect(routePoints(route, 'elbow')).toEqual(route);
  });
});

// Decision 6: a label sits at a share of the drawn path's length, and a point
// dragged near the path gives the share it is at.
describe('a label placed along the path', () => {
  const bent = [0, 0, 100, 0, 100, 100];

  it('sits a quarter along at 0.25, following bends', () => {
    expect(labelPoint(bent, 0.25)).toEqual({ x: 50, y: 0 });
    expect(labelPoint(bent, 0.75)).toEqual({ x: 100, y: 50 });
  });

  it('sits at the middle without a position', () => {
    expect(labelPoint(bent)).toEqual({ x: 100, y: 0 });
  });

  it('gives the share along the path nearest a point', () => {
    expect(positionAlong(bent, { x: 40, y: 10 })).toBeCloseTo(0.2);
    expect(positionAlong(bent, { x: 130, y: 150 })).toBe(1);
  });
});

// 06.16 H6: strokes-only heads dot with a dotted line; filled ones stay solid.
describe('a head on a dotted line', () => {
  it('is dotted a little tighter when drawn in strokes, solid otherwise', () => {
    expect(headDash('arrow', 'dotted', 2)).toEqual([1.5, 6]);
    expect(headDash('triangle', 'dotted', 2)).toEqual([]);
    expect(headDash('arrow', 'dashed', 2)).toEqual([]);
  });
});

// 06.16 L2, L6: where a label sits and how wide it wraps, as Excalidraw's
// (`linearElementEditor.ts:1942-1961`, `textElement.ts:511-521`).
describe("an arrow's label", () => {
  const arrow = (over: Record<string, unknown>) => ({ id: 'a', type: 'arrow', x: 0, y: 0, w: 100, h: 300, z: 1, ...over }) as never;

  it('sits on the middle point of an odd number of points', () => {
    expect(labelSpot(arrow({ points: [0, 0, 100, 0, 100, 300] }), 0)).toEqual({ x: 100, y: 0 });
  });

  it('sits at the middle of the middle segment of an even number', () => {
    expect(labelSpot(arrow({ points: [0, 0, 100, 0, 100, 300, 200, 300] }), 0)).toEqual({ x: 100, y: 150 });
  });

  it('keeps a slid label where it was slid, along the length', () => {
    expect(labelSpot(arrow({ points: [0, 0, 100, 0, 100, 300], labelPosition: 0.5 }), 0)).toEqual({ x: 100, y: 100 });
  });

  it('wraps to 0.7 of the arrow or 11 times the font size, the wider', () => {
    expect(labelWrapWidth(arrow({ w: 100 }), 20)).toBe(220);
    expect(labelWrapWidth(arrow({ w: 1000 }), 20)).toBe(700);
  });
});
