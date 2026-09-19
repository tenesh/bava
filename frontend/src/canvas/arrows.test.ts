import { describe, expect, it } from 'vitest';
import { drawHead, headAt, routePoints, labelPoint } from './arrows';

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

  it('leaves a stroke with many points alone, whatever the type', () => {
    const many = [0, 0, 10, 10, 20, 0, 30, 10];
    expect(routePoints(many, 'elbow')).toEqual(many);
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
