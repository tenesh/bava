/**
 * Holding Shift constrains a drag: a square box, or an angle in steps.
 *
 * Pure geometry, so the parts easy to get subtly wrong (a drag that goes up
 * and to the left, an angle that loses its length) are tested directly.
 */
import type { Box } from './selection';

type Point = { x: number; y: number };

/** Steps a constrained line or arrow snaps to, in degrees. */
export const ANGLE_STEP = 15;

/**
 * The box of a drag, squared by its longer side and still anchored at the
 * origin corner, so it grows in the direction the pointer went.
 */
export function squareBox(origin: Point, point: Point): Box {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const x = dx < 0 ? origin.x - side : origin.x;
  const y = dy < 0 ? origin.y - side : origin.y;
  return { x, y, w: side, h: side };
}

/** The drag's end point rotated to the nearest `step` degrees, same length. */
export function snapAngle(origin: Point, point: Point, step = ANGLE_STEP): Point {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: point.x, y: point.y };
  const radians = (step * Math.PI) / 180;
  const snapped = Math.round(Math.atan2(dy, dx) / radians) * radians;
  return { x: origin.x + Math.cos(snapped) * length, y: origin.y + Math.sin(snapped) * length };
}
