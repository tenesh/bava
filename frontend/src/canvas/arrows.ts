/**
 * How an arrow is drawn between its two ends: straight, elbow or arc.
 *
 * Pure geometry over the stored `points`, so the routing is tested directly.
 * The file keeps the ends the user drew; the route is derived each time, which
 * is what lets an arrow re-route when Milestone 6.5 attaches it to a shape.
 */
import type { PathSink } from './shapes';

/** Points on the curve an arc is drawn as. More is smoother and slower. */
const ARC_STEPS = 12;

/** How far an arc bows from the straight line, as a share of its length. */
const ARC_BOW = 0.2;

export type ArrowType = 'straight' | 'elbow' | 'arc';

/**
 * The drawn path for `points` (a flat x,y list relative to the element).
 * Anything but a two-point arrow is returned unchanged: a stroke's recorded
 * path is its own.
 */
export function routePoints(points: number[], type: string | undefined): number[] {
  if (points.length !== 4 || !type || type === 'straight') return points;
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
 * The point halfway along a routed path, where an arrow's label sits.
 *
 * Measured along the path rather than between the ends, so an elbow's label
 * lands on the line rather than floating in the corner it turns around.
 */
export function labelPoint(points: number[]): { x: number; y: number } {
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
    if (travelled + lengths[segment] < total / 2) {
      travelled += lengths[segment];
      continue;
    }
    const along = lengths[segment] === 0 ? 0 : (total / 2 - travelled) / lengths[segment];
    const i = segment * 2;
    return {
      x: points[i] + (points[i + 2] - points[i]) * along,
      y: points[i + 1] + (points[i + 3] - points[i + 1]) * along,
    };
  }
  return { x: points[points.length - 2], y: points[points.length - 1] };
}
