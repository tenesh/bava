import { describe, expect, it } from 'vitest';
import { adaptEnds, moveSegment, releaseSegment, renormalise, type SegmentEnd } from './elbow-segments';
import { routeElbow } from './elbow';
import type { Point } from './binding';

// 06.14 E8 to E11: segments of an elbow the user dragged, kept by index
// (`.claude/work/specs/excalidraw-elbow-segments.md`).

const p = (x: number, y: number): Point => ({ x, y });

// A leaves A's right side at (100, 50), runs to x = 200, down to y = 250 and
// right into B's left side at (300, 250).
const route = [p(100, 50), p(200, 50), p(200, 250), p(300, 250)];
const boundStart: SegmentEnd = { point: p(100, 50), heading: 'right', box: { x: 0, y: 0, w: 100, h: 100 } };
const boundEnd: SegmentEnd = { point: p(300, 250), heading: 'left', box: { x: 300, y: 200, w: 100, h: 100 } };
const freeStart: SegmentEnd = { point: p(100, 50), heading: 'right' };
const freeEnd: SegmentEnd = { point: p(300, 250), heading: 'left' };

describe('dragging a middle segment', () => {
  it('moves only its two points, across itself, and fixes it', () => {
    const moved = moveSegment(route, [], 2, 230, boundStart, boundEnd);
    expect(moved.points).toEqual([p(100, 50), p(230, 50), p(230, 250), p(300, 250)]);
    expect(moved.fixed).toEqual([2]);
    expect(moved.index).toBe(2);
  });

  it('leaves other fixed segments fixed, at their indices', () => {
    const longer = [p(100, 50), p(200, 50), p(200, 150), p(250, 150), p(250, 250), p(300, 250)];
    const moved = moveSegment(longer, [4], 2, 180, boundStart, boundEnd);
    expect(moved.fixed).toEqual([2, 4]);
    expect(moved.points[3]).toEqual(p(250, 150));
  });
});

describe('dragging the first or last segment', () => {
  it('adds a stub 40 out from a bound start, and shifts the indices by two', () => {
    const moved = moveSegment(route, [2], 1, 20, boundStart, boundEnd);
    expect(moved.points.slice(0, 4)).toEqual([p(100, 50), p(140, 50), p(140, 20), p(200, 20)]);
    expect(moved.index).toBe(3);
    expect(moved.fixed).toEqual([3, 4]);
  });

  it('adds half the segment when it is shorter than 45', () => {
    const short = [p(100, 50), p(130, 50), p(130, 250), p(300, 250)];
    const moved = moveSegment(short, [], 1, 20, boundStart, boundEnd);
    expect(moved.points.slice(0, 3)).toEqual([p(100, 50), p(115, 50), p(115, 20)]);
  });

  it('adds one point at a free start, shifting the indices by one', () => {
    const moved = moveSegment(route, [], 1, 20, freeStart, freeEnd);
    expect(moved.points.slice(0, 3)).toEqual([p(100, 50), p(100, 20), p(200, 20)]);
    expect(moved.index).toBe(2);
  });

  it('adds a stub 40 out from a bound end', () => {
    const moved = moveSegment(route, [], 3, 280, boundStart, boundEnd);
    expect(moved.points.slice(-4)).toEqual([p(200, 280), p(260, 280), p(260, 250), p(300, 250)]);
    expect(moved.index).toBe(3);
  });

  it('keeps a free end where it is, whichever way its last segment runs', () => {
    const moved = moveSegment(route, [], 3, 280, boundStart, freeEnd);
    expect(moved.points.at(-1)).toEqual(p(300, 250));
    expect(moved.points.at(-2)).toEqual(p(300, 280));
  });
});

describe('moving the ends of an elbow with fixed segments', () => {
  const shaped = [p(100, 50), p(230, 50), p(230, 250), p(300, 250)];

  it('keeps the fixed segment and adapts only the legs', () => {
    // B moved down 30: its end is now at (300, 280).
    const moved = adaptEnds(shaped, [2], boundStart, { ...boundEnd, point: p(300, 280) });
    expect(moved?.points).toEqual([p(100, 50), p(230, 50), p(230, 280), p(300, 280)]);
    expect(moved?.fixed).toEqual([2]);
  });

  it('inserts a stub pair 40 out when an end would leave along its side', () => {
    // A's end moved to its bottom side, heading down: parallel to the fixed
    // vertical segment, so the route steps out 40 and across.
    const start: SegmentEnd = { point: p(50, 100), heading: 'down', box: boundStart.box };
    const moved = adaptEnds(shaped, [2], start, boundEnd);
    expect(moved?.points).toEqual([p(50, 100), p(50, 140), p(230, 140), p(230, 250), p(300, 250)]);
    expect(moved?.fixed).toEqual([3]);
  });

  it('gives the same result twice', () => {
    const start: SegmentEnd = { point: p(50, 100), heading: 'down', box: boundStart.box };
    const once = adaptEnds(shaped, [2], start, boundEnd)!;
    expect(adaptEnds(once.points, once.fixed, start, boundEnd)).toEqual(once);
  });
});

describe('releasing a fixed segment', () => {
  const router = (from: SegmentEnd, to: SegmentEnd) => routeElbow(from, to, { gap: 4 });

  it('is a full route when it was the only one', () => {
    expect(releaseSegment(route, [2], 2, boundStart, boundEnd, router)).toBeNull();
  });

  it('re-routes between its fixed neighbours and keeps what is outside them', () => {
    const three = [p(100, 50), p(150, 50), p(150, 120), p(180, 120), p(180, 180), p(250, 180), p(250, 250), p(300, 250)];
    const released = releaseSegment(three, [2, 4, 6], 4, boundStart, boundEnd, router)!;
    const { points, fixed } = released;
    expect(points.slice(0, 2)).toEqual(three.slice(0, 2));
    expect(points.slice(-2)).toEqual(three.slice(-2));
    // Both neighbours still fixed, still on their lines (a join may have
    // lengthened one, where the new route runs straight on from it).
    expect(fixed).toHaveLength(2);
    const segment = (index: number) => [points[index - 1], points[index]];
    expect(segment(fixed[0]).map((q) => q.x)).toEqual([150, 150]);
    expect(segment(fixed[1]).map((q) => q.x)).toEqual([250, 250]);
    expect(segment(fixed[1])[1]).toEqual(p(250, 250));
    for (let i = 1; i < points.length; i += 1) expect(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y).toBe(true);
  });
});

describe('tidying a shaped route', () => {
  it('merges a straight-through point, keeping the segment fixed', () => {
    const tidied = renormalise([p(0, 0), p(50, 0), p(50, 50), p(50, 100), p(100, 100)], [2]);
    expect(tidied).toEqual({ points: [p(0, 0), p(50, 0), p(50, 100), p(100, 100)], fixed: [2] });
  });

  it('collapses a jog shorter than a unit', () => {
    const tidied = renormalise([p(0, 0), p(50, 0), p(50, 40), p(50.5, 40), p(50.5, 100), p(100, 100)], [2]);
    expect(tidied?.points).toEqual([p(0, 0), p(50, 0), p(50, 100), p(100, 100)]);
    expect(tidied?.fixed).toEqual([2]);
  });

  it('drops a fixed first or last segment, and is null with none left', () => {
    expect(renormalise(route, [1])).toBeNull();
    expect(renormalise(route, [3])).toBeNull();
  });
});
