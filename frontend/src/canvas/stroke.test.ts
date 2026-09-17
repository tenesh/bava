import { describe, expect, it } from 'vitest';
import { simplify, strokeOutline } from './stroke';

/** A pointer stream samples far more densely than a shape needs. */
function denseLine(count: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < count; i += 1) points.push(i, 0);
  return points;
}

function maxDeviation(original: number[], simplified: number[]): number {
  // Every original point should still be close to the simplified polyline.
  let worst = 0;
  for (let i = 0; i < original.length; i += 2) {
    const px = original[i];
    const py = original[i + 1];
    let best = Infinity;
    for (let j = 0; j < simplified.length - 2; j += 2) {
      const d = distanceToSegment(
        px,
        py,
        simplified[j],
        simplified[j + 1],
        simplified[j + 2],
        simplified[j + 3],
      );
      best = Math.min(best, d);
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

describe('stroke simplification', () => {
  // A raw pointer stream is thousands of points and every one would end up in
  // the file. Simplification has to shrink it *and* keep the shape, so the
  // tolerance is asserted: it cannot be "fixed" by skipping simplification.
  it('drops points from a dense straight line', () => {
    const dense = denseLine(400);
    const simplified = simplify(dense, 1);
    expect(simplified.length).toBeLessThan(dense.length / 4);
  });

  it('keeps the shape within tolerance', () => {
    const wave: number[] = [];
    for (let i = 0; i < 300; i += 1) wave.push(i, Math.sin(i / 10) * 40);
    const simplified = simplify(wave, 2);
    expect(simplified.length).toBeLessThan(wave.length);
    expect(maxDeviation(wave, simplified)).toBeLessThanOrEqual(2.5);
  });

  it('keeps the endpoints exactly', () => {
    const wave: number[] = [];
    for (let i = 0; i < 100; i += 1) wave.push(i, i % 7);
    const simplified = simplify(wave, 2);
    expect(simplified.slice(0, 2)).toEqual(wave.slice(0, 2));
    expect(simplified.slice(-2)).toEqual(wave.slice(-2));
  });

  it('leaves a short stroke alone', () => {
    const tiny = [0, 0, 1, 1];
    expect(simplify(tiny, 2)).toEqual(tiny);
  });
});

describe('stroke outline', () => {
  it('turns samples into a closed outline', () => {
    const outline = strokeOutline([0, 0, 10, 0, 20, 5]);
    expect(outline.length).toBeGreaterThan(6);
    expect(outline.length % 2).toBe(0);
  });

  it('returns nothing for an empty stroke', () => {
    expect(strokeOutline([])).toEqual([]);
  });
});
