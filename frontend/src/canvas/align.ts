/**
 * Align and distribute: how far each unit of a selection moves.
 *
 * A unit is what the user selected: an element, or a group standing for its
 * children. Pure functions over boxes return moves; the caller applies each
 * move to the unit and everything inside it, as one history step.
 */
import type { Box } from './selection';

export type Unit = { id: string; box: Box };

export type Alignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export type Move = { dx: number; dy: number };

function bounds(units: Unit[]): Box {
  const left = Math.min(...units.map((u) => u.box.x));
  const top = Math.min(...units.map((u) => u.box.y));
  const right = Math.max(...units.map((u) => u.box.x + u.box.w));
  const bottom = Math.max(...units.map((u) => u.box.y + u.box.h));
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Moves lining units up with an edge or centre of their bounds. Needs two. */
export function alignMoves(units: Unit[], alignment: Alignment): Map<string, Move> {
  const moves = new Map<string, Move>();
  if (units.length < 2) return moves;
  const b = bounds(units);
  for (const { id, box } of units) {
    let dx = 0;
    let dy = 0;
    switch (alignment) {
      case 'left':
        dx = b.x - box.x;
        break;
      case 'center':
        dx = b.x + b.w / 2 - (box.x + box.w / 2);
        break;
      case 'right':
        dx = b.x + b.w - (box.x + box.w);
        break;
      case 'top':
        dy = b.y - box.y;
        break;
      case 'middle':
        dy = b.y + b.h / 2 - (box.y + box.h / 2);
        break;
      case 'bottom':
        dy = b.y + b.h - (box.y + box.h);
        break;
    }
    if (dx !== 0 || dy !== 0) moves.set(id, { dx, dy });
  }
  return moves;
}

/**
 * Moves spacing units evenly along an axis: the outermost stay put and the
 * gaps between neighbours, ordered by position, become equal. Needs three.
 */
export function distributeMoves(units: Unit[], axis: 'horizontal' | 'vertical'): Map<string, Move> {
  const moves = new Map<string, Move>();
  if (units.length < 3) return moves;
  const start = (u: Unit) => (axis === 'horizontal' ? u.box.x : u.box.y);
  const size = (u: Unit) => (axis === 'horizontal' ? u.box.w : u.box.h);
  const sorted = [...units].sort((a, b) => start(a) - start(b));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = start(last) + size(last) - start(first);
  const occupied = sorted.reduce((sum, u) => sum + size(u), 0);
  const gap = (span - occupied) / (sorted.length - 1);

  let cursor = start(first) + size(first) + gap;
  for (const unit of sorted.slice(1, -1)) {
    const delta = cursor - start(unit);
    if (delta !== 0) moves.set(unit.id, axis === 'horizontal' ? { dx: delta, dy: 0 } : { dx: 0, dy: delta });
    cursor += size(unit) + gap;
  }
  return moves;
}
