import { describe, expect, it } from 'vitest';
import { drawHead, headAt, routePoints, labelPoint, positionAlong } from './arrows';

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

  it('bows an arc to one side, keeping its ends', () => {
    const points = routePoints(from, 'arc');
    expect(points.slice(0, 2)).toEqual([0, 0]);
    expect(points.slice(-2)).toEqual([100, 60]);
    expect(points.length).toBeGreaterThan(from.length);
    // Every middle point sits off the straight line between the ends.
    const offLine = points.slice(2, -2).some((_, i) => i % 2 === 0 && Math.abs(points[2 + i + 1] - (points[2 + i] * 0.6)) > 1);
    expect(offLine).toBe(true);
  });

  // Many points no longer means "a stroke": an arrow's bends are points too,
  // and the kind decides how they are drawn (see 'routing through bends').
  // A stroke never has a kind, so it is still drawn as recorded.
  it('leaves many points alone when there is no kind', () => {
    const many = [0, 0, 10, 10, 20, 0, 30, 10];
    expect(routePoints(many, undefined)).toEqual(many);
  });
});

describe('arrowhead shapes', () => {
  const sink = () => {
    const calls: string[] = [];
    return {
      calls,
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      bezierCurveTo: () => calls.push('curve'),
      closePath: () => calls.push('close'),
    };
  };

  it('draws nothing for none', () => {
    const s = sink();
    expect(drawHead(s, 'none', 10)).toBe(false);
    expect(s.calls).toEqual([]);
  });

  it('draws each head, and says whether it is filled', () => {
    for (const kind of ['arrow', 'triangle', 'bar', 'circle', 'diamond']) {
      const s = sink();
      drawHead(s, kind, 10);
      expect(s.calls.length, kind).toBeGreaterThan(0);
    }
    expect(drawHead(sink(), 'triangle', 10)).toBe(true);
    expect(drawHead(sink(), 'triangle-outline', 10)).toBe(false);
    expect(drawHead(sink(), 'circle', 10)).toBe(true);
    expect(drawHead(sink(), 'circle-outline', 10)).toBe(false);
    expect(drawHead(sink(), 'arrow', 10)).toBe(false);
  });

  it('draws an unknown head as the default arrow', () => {
    const known = sink();
    drawHead(known, 'arrow', 10);
    const unknown = sink();
    drawHead(unknown, 'sparkle', 10);
    expect(unknown.calls).toEqual(known.calls);
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
