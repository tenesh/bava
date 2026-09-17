import { describe, expect, it } from 'vitest';
import { OUTLINE_SHAPES, drawOutline, type PathSink } from './shapes';

type Call = { op: string; points: [number, number][] };

function record(): PathSink & { calls: Call[] } {
  const calls: Call[] = [];
  const pairs = (args: number[]) => {
    const out: [number, number][] = [];
    for (let i = 0; i < args.length; i += 2) out.push([args[i], args[i + 1]]);
    return out;
  };
  return {
    calls,
    moveTo: (...a: number[]) => void calls.push({ op: 'moveTo', points: pairs(a) }),
    lineTo: (...a: number[]) => void calls.push({ op: 'lineTo', points: pairs(a) }),
    bezierCurveTo: (...a: number[]) => void calls.push({ op: 'bezierCurveTo', points: pairs(a) }),
    closePath: () => void calls.push({ op: 'closePath', points: [] }),
  };
}

const allPoints = (calls: Call[]) => calls.flatMap((c) => c.points);
const eps = 1e-9;

describe('shape outlines', () => {
  it('covers the seven shapes Konva has no primitive for', () => {
    expect([...OUTLINE_SHAPES].sort()).toEqual(
      ['cloud', 'cylinder', 'diamond', 'document', 'hexagon', 'parallelogram', 'person'].sort(),
    );
  });

  // Every point, curve control points included, stays inside the element's
  // box: hit-testing, selection and resize all assume the box holds the shape.
  it('stays within its box at several sizes', () => {
    for (const shape of OUTLINE_SHAPES) {
      for (const [w, h] of [
        [120, 80],
        [40, 200],
        [300, 10],
        [1, 1],
      ]) {
        const sink = record();
        drawOutline(shape, sink, w, h);
        expect(sink.calls.length, `${shape} drew nothing`).toBeGreaterThan(1);
        for (const [x, y] of allPoints(sink.calls)) {
          expect(x, `${shape} x at ${w}x${h}`).toBeGreaterThanOrEqual(-eps);
          expect(x, `${shape} x at ${w}x${h}`).toBeLessThanOrEqual(w + eps);
          expect(y, `${shape} y at ${w}x${h}`).toBeGreaterThanOrEqual(-eps);
          expect(y, `${shape} y at ${w}x${h}`).toBeLessThanOrEqual(h + eps);
        }
      }
    }
  });

  it('puts the diamond vertices at the edge midpoints', () => {
    const sink = record();
    drawOutline('diamond', sink, 100, 60);
    const points = allPoints(sink.calls).map(([x, y]) => `${x},${y}`);
    for (const vertex of ['50,0', '100,30', '50,60', '0,30']) expect(points).toContain(vertex);
  });

  it('draws the hexagon symmetric about its vertical centre line', () => {
    const sink = record();
    drawOutline('hexagon', sink, 100, 60);
    const points = allPoints(sink.calls).map(([x, y]) => `${x},${y}`).sort();
    const mirrored = allPoints(sink.calls).map(([x, y]) => `${100 - x},${y}`).sort();
    expect(points).toEqual(mirrored);
  });

  it('closes every outline', () => {
    for (const shape of OUTLINE_SHAPES) {
      const sink = record();
      drawOutline(shape, sink, 100, 60);
      expect(sink.calls.some((c) => c.op === 'closePath'), shape).toBe(true);
    }
  });
});
