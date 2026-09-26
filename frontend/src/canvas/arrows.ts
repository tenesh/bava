/**
 * How an arrow is drawn between its two ends: straight, elbow or arc.
 *
 * Pure geometry over the stored `points`, so the routing is tested directly.
 * The file keeps the ends the user drew; the route is derived each time, which
 * is what lets an arrow re-route when Milestone 6.5 attaches it to a shape.
 */
import type { PathSink } from './shapes';
import { SEGMENT_SAMPLES, smoothPoints } from './curves';
import { LINE_TENSION } from './paint';

/** Points on the curve an arc is drawn as. More is smoother and slower. */
const ARC_STEPS = 12;

/** How far an arc bows from the straight line, as a share of its length. */
const ARC_BOW = 0.2;

export type ArrowType = 'straight' | 'elbow' | 'arc';

/** An elbow's corners are drawn round, at most this radius (Excalidraw's 16). */
export const ELBOW_CORNER = 16;

/** Points on each rounded corner of an elbow, both ends of the curve included. */
const CORNER_STEPS = 6;

/**
 * The line an arrow is drawn along: its route (`routePoints`), with an
 * elbow's corners turned into curves. The one path the stage draws, the hit
 * test measures and the exporter writes, so the three agree.
 */
export function pathOf(points: number[], type: string | undefined): number[] {
  const route = routePoints(points, type);
  return type === 'elbow' ? roundCorners(route) : route;
}

/**
 * A right-angled route with each corner a quadratic curve of radius
 * min(`ELBOW_CORNER`, half of either neighbouring segment), as Excalidraw's
 * `generateElbowArrowShape` (`element/src/shape.ts:1018-1081`), sampled so
 * every renderer draws the same points.
 */
export function roundCorners(route: number[]): number[] {
  const count = route.length / 2;
  if (count < 3) return route;
  const out = [route[0], route[1]];
  for (let i = 1; i < count - 1; i += 1) {
    const [px, py, x, y, nx, ny] = route.slice(i * 2 - 2, i * 2 + 4);
    const before = Math.hypot(x - px, y - py);
    const after = Math.hypot(nx - x, ny - y);
    const radius = Math.min(ELBOW_CORNER, before / 2, after / 2);
    if (radius <= 0) {
      out.push(x, y);
      continue;
    }
    const from = { x: x + ((px - x) / before) * radius, y: y + ((py - y) / before) * radius };
    const to = { x: x + ((nx - x) / after) * radius, y: y + ((ny - y) / after) * radius };
    for (let step = 0; step <= CORNER_STEPS; step += 1) {
      const t = step / CORNER_STEPS;
      const u = 1 - t;
      out.push(u * u * from.x + 2 * u * t * x + t * t * to.x, u * u * from.y + 2 * u * t * y + t * t * to.y);
    }
  }
  out.push(route[route.length - 2], route[route.length - 1]);
  return out;
}

/**
 * The drawn path for `points` (a flat x,y list relative to the element).
 *
 * Bends are points; the kind decides how they are drawn: a straight arrow
 * runs through them with corners, an arc curves smoothly through them, and an
 * elbow routes itself from the first point to the last and draws none of them
 * (they are kept, for when the kind changes back). A stroke's recorded path
 * is its own and never reaches here.
 */
export function routePoints(points: number[], type: string | undefined): number[] {
  if (points.length < 4 || !type || type === 'straight') return points;
  if (points.length > 4) {
    if (type === 'arc') return smoothPoints(points, LINE_TENSION);
    // An elbow's points are its route, stored by `reroute` (`elbow.ts`).
    return points;
  }
  const [x1, y1, x2, y2] = points;

  if (type === 'elbow') {
    // Turn along the longer axis first, so the arrow reads as leaving that way.
    return Math.abs(x2 - x1) >= Math.abs(y2 - y1)
      ? [x1, y1, (x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2]
      : [x1, y1, x1, (y1 + y2) / 2, x2, (y1 + y2) / 2, x2, y2];
  }

  if (type === 'arc') {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    // The control point sits perpendicular to the line, to its left.
    const controlX = midX - (dy / length) * length * ARC_BOW;
    const controlY = midY + (dx / length) * length * ARC_BOW;
    const path: number[] = [];
    for (let step = 0; step <= ARC_STEPS; step += 1) {
      const t = step / ARC_STEPS;
      const inverse = 1 - t;
      path.push(
        inverse * inverse * x1 + 2 * inverse * t * controlX + t * t * x2,
        inverse * inverse * y1 + 2 * inverse * t * controlY + t * t * y2,
      );
    }
    return path;
  }

  return points;
}

/** Where a head sits and which way it points, in the element's own space. */
export function headAt(points: number[], end: 'start' | 'end'): { x: number; y: number; angle: number } {
  if (points.length < 4) return { x: points[0] ?? 0, y: points[1] ?? 0, angle: 0 };
  const [x, y, towardsX, towardsY] =
    end === 'end'
      ? [points[points.length - 2], points[points.length - 1], points[points.length - 4], points[points.length - 3]]
      : [points[0], points[1], points[2], points[3]];
  // The head points away from the segment it ends.
  const angle = (Math.atan2(y - towardsY, x - towardsX) * 180) / Math.PI;
  return { x, y, angle };
}

/**
 * Draw an arrowhead of `size` into a sink, pointing along +x with its tip at
 * the origin, as `shapes.ts` draws an outline. Returns whether the head is
 * filled; an outline head is stroked instead.
 */
export function drawHead(sink: PathSink, kind: string | undefined, size: number): boolean {
  const half = size / 2;
  switch (kind) {
    case 'none':
      return false;
    case 'bar':
      sink.moveTo(0, -half);
      sink.lineTo(0, half);
      return false;
    case 'triangle':
    case 'triangle-outline':
      sink.moveTo(0, 0);
      sink.lineTo(-size, -half);
      sink.lineTo(-size, half);
      sink.closePath();
      return kind === 'triangle';
    case 'circle':
    case 'circle-outline':
      circle(sink, -half, 0, half);
      return kind === 'circle';
    case 'diamond':
    case 'diamond-outline':
      sink.moveTo(0, 0);
      sink.lineTo(-half, -half);
      sink.lineTo(-size, 0);
      sink.lineTo(-half, half);
      sink.closePath();
      return kind === 'diamond';
    default:
      // The default head, and anything a newer Bava names: two strokes back
      // from the tip, the shape an arrow has always had here.
      sink.moveTo(-size, -half);
      sink.lineTo(0, 0);
      sink.lineTo(-size, half);
      return false;
  }
}

// Cubic Bézier approximation of a quarter circle, as in shapes.ts.
const KAPPA = 0.5522847498;

function circle(sink: PathSink, cx: number, cy: number, r: number): void {
  const o = r * KAPPA;
  sink.moveTo(cx - r, cy);
  sink.bezierCurveTo(cx - r, cy - o, cx - o, cy - r, cx, cy - r);
  sink.bezierCurveTo(cx + o, cy - r, cx + r, cy - o, cx + r, cy);
  sink.bezierCurveTo(cx + r, cy + o, cx + o, cy + r, cx, cy + r);
  sink.bezierCurveTo(cx - o, cy + r, cx - r, cy + o, cx - r, cy);
  sink.closePath();
}

/** How long a routed path is, which is the width an arrow's label wraps to. */
export function pathLength(points: number[]): number {
  let total = 0;
  for (let i = 0; i + 3 < points.length; i += 2) {
    total += Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
  }
  return total;
}

/**
 * The point `position` of the way along a routed path (half, by default),
 * where an arrow's label sits.
 *
 * Measured along the path rather than between the ends, so an elbow's label
 * lands on the line rather than floating in the corner it turns around, and a
 * label slid along a bent arrow follows its bends.
 */
export function labelPoint(points: number[], position = 0.5): { x: number; y: number } {
  if (points.length < 4) return { x: points[0] ?? 0, y: points[1] ?? 0 };

  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i + 3 < points.length; i += 2) {
    const length = Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
    lengths.push(length);
    total += length;
  }
  if (total === 0) return { x: points[0], y: points[1] };

  let travelled = 0;
  for (let segment = 0; segment < lengths.length; segment += 1) {
    if (travelled + lengths[segment] < total * position) {
      travelled += lengths[segment];
      continue;
    }
    const along = lengths[segment] === 0 ? 0 : (total * position - travelled) / lengths[segment];
    const i = segment * 2;
    return {
      x: points[i] + (points[i + 2] - points[i]) * along,
      y: points[i + 1] + (points[i + 3] - points[i + 1]) * along,
    };
  }
  return { x: points[points.length - 2], y: points[points.length - 1] };
}

/**
 * How far along a routed path, as a share of its length, the path comes
 * nearest `point`: where a label dragged to `point` goes.
 */
export function positionAlong(points: number[], point: { x: number; y: number }): number {
  const total = pathLength(points);
  if (total === 0) return 0.5;
  let best = Infinity;
  let bestAt = 0;
  let travelled = 0;
  for (let i = 0; i + 3 < points.length; i += 2) {
    const [x1, y1, x2, y2] = points.slice(i, i + 4);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - x1) * dx + (point.y - y1) * dy) / (length * length)));
    const distance = Math.hypot(point.x - (x1 + t * dx), point.y - (y1 + t * dy));
    if (distance < best) {
      best = distance;
      bestAt = travelled + t * length;
    }
    travelled += length;
  }
  return bestAt / total;
}

/**
 * For each segment between two points, where the drawn path is halfway
 * between them: where the handle for bending that segment sits. On a straight
 * run that is the segment's middle; on an arc or a smoothed line it is on the
 * curve, not the chord. An elbow offers no bends, so none.
 */
export function middlesAlong(points: number[], type: string | undefined, tension: number): { x: number; y: number }[] {
  const count = points.length / 2;
  if (count < 2 || type === 'elbow') return [];
  if (type === 'arc' && count === 2) return [labelPoint(routePoints(points, 'arc'))];
  const bend = type === 'arc' ? LINE_TENSION : tension;
  if (bend <= 0 || count < 3) {
    return Array.from({ length: count - 1 }, (_, i) => ({
      x: (points[i * 2] + points[i * 2 + 2]) / 2,
      y: (points[i * 2 + 1] + points[i * 2 + 3]) / 2,
    }));
  }
  // `smoothPoints` samples each segment from its first point, so segment i
  // runs from sample i·S to sample (i+1)·S.
  const smooth = smoothPoints(points, bend);
  return Array.from({ length: count - 1 }, (_, i) =>
    labelPoint(smooth.slice(i * SEGMENT_SAMPLES * 2, ((i + 1) * SEGMENT_SAMPLES + 1) * 2)),
  );
}
