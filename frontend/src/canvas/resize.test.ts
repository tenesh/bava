import { describe, expect, it } from 'vitest';
import { HANDLES, MIN_SIZE, handleAt, resizeBox, scaleInto } from './resize';

const box = { x: 100, y: 100, w: 200, h: 100 };

describe('resizeBox', () => {
  it('grows from the bottom-right handle and keeps the top-left corner', () => {
    expect(resizeBox(box, 'bottom-right', 20, 10)).toEqual({ x: 100, y: 100, w: 220, h: 110 });
  });

  it('moves the top-left corner and keeps the bottom-right one', () => {
    expect(resizeBox(box, 'top-left', 20, 10)).toEqual({ x: 120, y: 110, w: 180, h: 90 });
  });

  it('changes one dimension from an edge handle', () => {
    expect(resizeBox(box, 'right', 30, 999)).toEqual({ x: 100, y: 100, w: 230, h: 100 });
    expect(resizeBox(box, 'top', 999, -20)).toEqual({ x: 100, y: 80, w: 200, h: 120 });
  });

  // Dragging a handle past the opposite edge must not produce a negative or
  // vanishing box; it stops at the minimum instead.
  it('never shrinks below the minimum size', () => {
    const shrunk = resizeBox(box, 'bottom-right', -500, -500);
    expect(shrunk.w).toBeGreaterThanOrEqual(4);
    expect(shrunk.h).toBeGreaterThanOrEqual(4);
    expect(shrunk.x).toBe(100);
    const fromLeft = resizeBox(box, 'left', 500, 0);
    expect(fromLeft.w).toBe(4);
    expect(fromLeft.x).toBe(296);
  });

  // A vertical line has no width, so it has no aspect ratio to keep: dividing
  // by it wrote Infinity, and then null, into the file.
  it('ignores keep-aspect for a box with no width or height', () => {
    const line = resizeBox({ x: 0, y: 0, w: 0, h: 100 }, 'bottom-right', 10, 10, { keepAspect: true });
    expect(Number.isFinite(line.w) && Number.isFinite(line.h)).toBe(true);
  });

  it('keeps the aspect ratio from a corner when asked', () => {
    const scaled = resizeBox(box, 'bottom-right', 100, 0, { keepAspect: true });
    expect(scaled.w / scaled.h).toBeCloseTo(2);
    expect(scaled.w).toBe(300);
  });
});

describe('handleAt', () => {
  it('finds the handle under a point, within its size', () => {
    expect(handleAt({ x: 300, y: 200 }, box, 8)).toBe('bottom-right');
    expect(handleAt({ x: 197, y: 103 }, box, 8)).toBe('top');
    expect(handleAt({ x: 150, y: 150 }, box, 8)).toBeNull();
  });

  it('names eight handles', () => {
    expect(HANDLES).toHaveLength(8);
  });
});

describe('scaleInto', () => {
  // With several elements selected, each keeps its place within the group.
  it('maps an element from one box into another, points included', () => {
    const element = { x: 150, y: 125, w: 50, h: 50, points: [0, 0, 50, 50] };
    const scaled = scaleInto(element, box, { x: 100, y: 100, w: 400, h: 200 });
    expect(scaled).toEqual({ x: 200, y: 150, w: 100, h: 100, points: [0, 0, 100, 100] });
  });
});

describe('scaleInto for text', () => {
  // Text has a stored measurement that must describe its box. Resizing moves
  // text with its group but keeps its size.
  it('moves text but keeps its measured size', () => {
    const text = { type: 'text', x: 150, y: 125, w: 50, h: 20, measuredWidth: 50, measuredHeight: 20 };
    expect(scaleInto(text, box, { x: 100, y: 100, w: 400, h: 200 })).toEqual({
      type: 'text',
      x: 200,
      y: 150,
      w: 50,
      h: 20,
      measuredWidth: 50,
      measuredHeight: 20,
    });
  });
});

// Shift keeps the proportions from any handle: an edge scales the other axis
// about the opposite edge, as Excalidraw does.
describe('keeping proportions', () => {
  const box = { x: 0, y: 0, w: 100, h: 50 };

  it('keeps them from a corner', () => {
    expect(resizeBox(box, 'bottom-right', 100, 0, { keepAspect: true })).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });

  it('keeps them from a side handle, growing the other axis', () => {
    expect(resizeBox(box, 'right', 100, 0, { keepAspect: true })).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });

  it('keeps them from a top handle, anchored at the bottom', () => {
    expect(resizeBox(box, 'top', -50, -50, { keepAspect: true })).toEqual({ x: 0, y: -50, w: 200, h: 100 });
  });

  it('leaves the free resize alone', () => {
    expect(resizeBox(box, 'right', 100, 0)).toEqual({ x: 0, y: 0, w: 200, h: 50 });
  });
});

describe('keeping proportions at the limits', () => {
  it('keeps the ratio when a drag collapses the box to its minimum', () => {
    const result = resizeBox({ x: 0, y: 0, w: 100, h: 50 }, 'right', -98, 0, { keepAspect: true });
    expect(result.w / result.h).toBeCloseTo(2, 5);
    expect(Math.min(result.w, result.h)).toBeGreaterThanOrEqual(MIN_SIZE);
  });

  it('leaves a flat element alone: it has no ratio', () => {
    expect(resizeBox({ x: 0, y: 0, w: 100, h: 0 }, 'right', 50, 0, { keepAspect: true })).toMatchObject({ w: 150, h: 0 });
  });

  it('scales a points-bearing element with the box', () => {
    const line = { id: 'l', z: 1, type: 'line', x: 0, y: 0, w: 100, h: 50, points: [0, 0, 100, 50] } as never;
    const scaled = scaleInto(line, { x: 0, y: 0, w: 100, h: 50 }, { x: 0, y: 0, w: 200, h: 100 }) as unknown as {
      points: number[];
      w: number;
      h: number;
    };
    expect(scaled.points).toEqual([0, 0, 200, 100]);
    expect(scaled).toMatchObject({ w: 200, h: 100 });
  });
});
