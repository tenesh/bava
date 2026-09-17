import { describe, expect, it } from 'vitest';
import { alignMoves, distributeMoves, type Unit } from './align';

const unit = (id: string, x: number, y: number, w = 10, h = 10): Unit => ({ id, box: { x, y, w, h } });

const apply = (units: Unit[], moves: Map<string, { dx: number; dy: number }>) =>
  Object.fromEntries(
    units.map((u) => {
      const m = moves.get(u.id) ?? { dx: 0, dy: 0 };
      return [u.id, { x: u.box.x + m.dx, y: u.box.y + m.dy }];
    }),
  );

describe('align', () => {
  const units = [unit('a', 0, 0, 10, 10), unit('b', 30, 20, 20, 40)];
  // Bounds: x 0..50, y 0..60.

  it('aligns left, centre and right to the bounds', () => {
    expect(apply(units, alignMoves(units, 'left'))).toEqual({ a: { x: 0, y: 0 }, b: { x: 0, y: 20 } });
    expect(apply(units, alignMoves(units, 'center'))).toEqual({ a: { x: 20, y: 0 }, b: { x: 15, y: 20 } });
    expect(apply(units, alignMoves(units, 'right'))).toEqual({ a: { x: 40, y: 0 }, b: { x: 30, y: 20 } });
  });

  it('aligns top, middle and bottom to the bounds', () => {
    expect(apply(units, alignMoves(units, 'top'))).toEqual({ a: { x: 0, y: 0 }, b: { x: 30, y: 0 } });
    expect(apply(units, alignMoves(units, 'middle'))).toEqual({ a: { x: 0, y: 25 }, b: { x: 30, y: 10 } });
    expect(apply(units, alignMoves(units, 'bottom'))).toEqual({ a: { x: 0, y: 50 }, b: { x: 30, y: 20 } });
  });

  it('does nothing for fewer than two units', () => {
    expect(alignMoves([unit('a', 5, 5)], 'left').size).toBe(0);
  });
});

describe('distribute', () => {
  it('equalises the gaps and keeps the outermost units in place', () => {
    // Widths 10, gaps 0..10 is 0, then 10..40 is 30: total gap 30 over 2 gaps.
    const units = [unit('a', 0, 0), unit('b', 10, 0), unit('c', 50, 0)];
    const moved = apply(units, distributeMoves(units, 'horizontal'));
    expect(moved.a.x).toBe(0);
    expect(moved.c.x).toBe(50);
    expect(moved.b.x).toBe(25);
  });

  it('orders by position, not selection order', () => {
    const units = [unit('c', 0, 50), unit('a', 0, 0), unit('b', 0, 10)];
    const moved = apply(units, distributeMoves(units, 'vertical'));
    expect(moved.a.y).toBe(0);
    expect(moved.c.y).toBe(50);
    expect(moved.b.y).toBe(25);
  });

  it('does nothing for fewer than three units', () => {
    expect(distributeMoves([unit('a', 0, 0), unit('b', 30, 0)], 'horizontal').size).toBe(0);
  });
});
