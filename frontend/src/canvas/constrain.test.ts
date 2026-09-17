import { describe, expect, it } from 'vitest';
import { snapAngle, squareBox } from './constrain';

describe('squareBox', () => {
  it('squares a wide drag by its longer side, keeping the origin corner', () => {
    expect(squareBox({ x: 10, y: 10 }, { x: 110, y: 50 })).toEqual({ x: 10, y: 10, w: 100, h: 100 });
  });

  it('squares a tall drag the same way', () => {
    expect(squareBox({ x: 10, y: 10 }, { x: 50, y: 130 })).toEqual({ x: 10, y: 10, w: 120, h: 120 });
  });

  it('grows up and to the left when the drag does', () => {
    expect(squareBox({ x: 100, y: 100 }, { x: 40, y: 80 })).toEqual({ x: 40, y: 40, w: 60, h: 60 });
  });

  it('is empty for a drag that went nowhere', () => {
    expect(squareBox({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5, w: 0, h: 0 });
  });
});

describe('snapAngle', () => {
  const round = (p: { x: number; y: number }) => ({ x: Math.round(p.x), y: Math.round(p.y) });

  it('snaps to the nearest 15 degrees, keeping the length', () => {
    // 100 to the right, 5 up: about 3°, snaps to 0° and keeps its length.
    expect(round(snapAngle({ x: 0, y: 0 }, { x: 100, y: -5 }))).toEqual({ x: 100, y: 0 });
    // 100 to the right, 20 up: about 11°, nearer 15° than 0°.
    expect(round(snapAngle({ x: 0, y: 0 }, { x: 100, y: -20 }))).toEqual({ x: 99, y: -26 });
    // 45° stays 45°, at the same distance.
    const diagonal = round(snapAngle({ x: 0, y: 0 }, { x: 70, y: 70 }));
    expect(diagonal).toEqual({ x: 70, y: 70 });
  });

  it('snaps 38 degrees to 45, and 20 to 15', () => {
    const at38 = snapAngle({ x: 0, y: 0 }, { x: Math.cos(0.663) * 100, y: Math.sin(0.663) * 100 });
    expect(Math.round((Math.atan2(at38.y, at38.x) * 180) / Math.PI)).toBe(45);
    const at20 = snapAngle({ x: 0, y: 0 }, { x: Math.cos(0.349) * 100, y: Math.sin(0.349) * 100 });
    expect(Math.round((Math.atan2(at20.y, at20.x) * 180) / Math.PI)).toBe(15);
  });

  it('leaves a zero-length drag alone', () => {
    expect(snapAngle({ x: 3, y: 4 }, { x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
  });
});

describe('squareBox in the mixed quadrants', () => {
  it('grows up and to the right', () => {
    expect(squareBox({ x: 0, y: 0 }, { x: 100, y: -40 })).toEqual({ x: 0, y: -100, w: 100, h: 100 });
  });

  it('grows down and to the left', () => {
    expect(squareBox({ x: 100, y: 0 }, { x: 60, y: 90 })).toEqual({ x: 10, y: 0, w: 90, h: 90 });
  });
});
