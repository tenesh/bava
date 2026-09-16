/**
 * Freehand strokes.
 *
 * Two steps, and both matter. `perfect-freehand` turns pointer samples into a
 * pressure-aware outline, which is what gets drawn. Simplification runs first,
 * because a raw pointer stream is thousands of points and every one of them
 * would otherwise be written to the file.
 */
import getStroke from 'perfect-freehand';

/**
 * Ramer-Douglas-Peucker: drop points that sit within `tolerance` of the line
 * between the points that survive. Endpoints are always kept.
 */
export function simplify(points: number[], tolerance: number): number[] {
  if (points.length <= 4) return [...points];

  const keep = new Array(points.length / 2).fill(false);
  keep[0] = true;
  keep[keep.length - 1] = true;

  const stack: [number, number][] = [[0, keep.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let worst = 0;
    let worstIndex = -1;

    for (let i = start + 1; i < end; i += 1) {
      const distance = perpendicularDistance(points, i, start, end);
      if (distance > worst) {
        worst = distance;
        worstIndex = i;
      }
    }

    if (worst > tolerance && worstIndex !== -1) {
      keep[worstIndex] = true;
      stack.push([start, worstIndex], [worstIndex, end]);
    }
  }

  const out: number[] = [];
  for (let i = 0; i < keep.length; i += 1) {
    if (!keep[i]) continue;
    out.push(points[i * 2], points[i * 2 + 1]);
  }
  return out;
}

function perpendicularDistance(points: number[], i: number, start: number, end: number): number {
  const px = points[i * 2];
  const py = points[i * 2 + 1];
  const ax = points[start * 2];
  const ay = points[start * 2 + 1];
  const bx = points[end * 2];
  const by = points[end * 2 + 1];

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** The drawable outline for a stroke, as a flat point list. */
export function strokeOutline(points: number[]): number[] {
  if (points.length === 0) return [];

  const pairs: number[][] = [];
  for (let i = 0; i < points.length; i += 2) pairs.push([points[i], points[i + 1]]);

  return getStroke(pairs, { size: 4, thinning: 0.5, smoothing: 0.5, streamline: 0.5 }).flat();
}
