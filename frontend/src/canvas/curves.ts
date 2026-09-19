/**
 * Smoothing a polyline, for an element whose edges are round.
 *
 * Konva can smooth a line itself, through `tension`, but its curve lives
 * inside Konva and the exporter cannot see it: a line with round edges then
 * drew as a curve on the canvas and as hard corners in an exported SVG. The
 * smoothing happens here instead, once, and both renderers draw the points it
 * returns (`.ai/rules/canvas.md`).
 */

/** How many samples each segment becomes. Enough to read as a curve at 3x. */
const SEGMENT_SAMPLES = 12;

/**
 * `points` (flat x,y pairs) bent through its corners, as a Catmull-Rom spline
 * with `tension` as its slackness. The ends stay exactly where they were, and
 * the curve stays within the span of the points it was given.
 *
 * Fewer than three points, or no tension, is returned untouched: there is no
 * corner to round.
 */
export function smoothPoints(points: number[], tension: number, samples = SEGMENT_SAMPLES): number[] {
  if (tension <= 0 || points.length < 6) return points;

  const count = points.length / 2;
  const at = (i: number): [number, number] => {
    const index = Math.min(count - 1, Math.max(0, i));
    return [points[index * 2], points[index * 2 + 1]];
  };

  const out: number[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    for (let step = 0; step < samples; step += 1) {
      const t = step / samples;
      out.push(catmullRom(x0, x1, x2, x3, t, tension), catmullRom(y0, y1, y2, y3, t, tension));
    }
  }
  // The last point is the end itself, never a sample near it.
  out.push(points[points.length - 2], points[points.length - 1]);
  return out;
}

/** One coordinate of a Catmull-Rom spline, scaled by `tension`. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number, tension: number): number {
  const m1 = tension * (p2 - p0);
  const m2 = tension * (p3 - p1);
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2
  );
}
