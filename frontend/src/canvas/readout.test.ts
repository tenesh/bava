import { describe, expect, it } from 'vitest';
import { readoutAt, readoutText } from './readout';

describe('the position shown while moving', () => {
  it('reads the top-left in whole canvas units', () => {
    expect(readoutText({ x: 519.6, y: 320.2, w: 130, h: 56 })).toBe('x 520 · y 320');
  });

  it('reads a negative position, and never a negative zero', () => {
    expect(readoutText({ x: -40.4, y: -0.3, w: 10, h: 10 })).toBe('x -40 · y 0');
  });

  // Below the bottom-left corner, the same screen distance at every zoom: in
  // scene units the gap shrinks as the zoom grows.
  it.each([0.5, 1, 2])('sits a fixed screen gap below the bottom-left at zoom %s', (zoom) => {
    const at = readoutAt({ x: 100, y: 50, w: 80, h: 40 }, zoom, 8);
    expect(at.x).toBe(100);
    expect((at.y - 90) * zoom).toBeCloseTo(8);
  });
});
