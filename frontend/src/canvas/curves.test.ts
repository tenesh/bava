import { describe, expect, it } from 'vitest';
import { smoothPoints } from './curves';

const at = (points: number[], i: number) => [points[i * 2], points[i * 2 + 1]];

describe('smoothing a polyline', () => {
  it('keeps the ends exactly where they were', () => {
    const smoothed = smoothPoints([0, 0, 50, 40, 100, 0], 0.4);
    expect(at(smoothed, 0)).toEqual([0, 0]);
    expect(at(smoothed, smoothed.length / 2 - 1)).toEqual([100, 0]);
  });

  // A Catmull-Rom curve runs through its points rather than cutting the
  // corner: what smoothing changes is the path between them, which is what
  // Konva's tension does too.
  it('still passes through the points, and bends between them', () => {
    const points = [0, 0, 50, 40, 100, 0];
    const smoothed = smoothPoints(points, 0.4);
    expect(smoothed.length).toBeGreaterThan(points.length);

    const pairs = [...Array(smoothed.length / 2)].map((_, i) => [smoothed[i * 2], smoothed[i * 2 + 1]]);
    expect(pairs.some(([x, y]) => x === 50 && y === 40)).toBe(true);
    // A straight polyline would put y = 0.8x on the way to the corner.
    const straight = pairs.filter(([x]) => x > 0 && x < 50).every(([x, y]) => Math.abs(y - x * 0.8) < 1e-9);
    expect(straight).toBe(false);
  });

  it('stays inside the span of the points it was given', () => {
    const smoothed = smoothPoints([0, 0, 50, 40, 100, 0], 0.4);
    const xs = smoothed.filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(100);
  });

  it('leaves a straight two-point line alone', () => {
    expect(smoothPoints([0, 0, 10, 10], 0.4)).toEqual([0, 0, 10, 10]);
  });

  it('leaves everything alone at zero tension', () => {
    const points = [0, 0, 50, 40, 100, 0];
    expect(smoothPoints(points, 0)).toEqual(points);
  });
});
