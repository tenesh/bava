/**
 * Segments of an elbow the user dragged, and how the route keeps them.
 *
 * Excalidraw's fixed segments (`.claude/work/specs/excalidraw-elbow-segments.md`,
 * `element/src/elbowArrow.ts:113-900`), in Bava's own code. A fixed segment is
 * an index: segment `i` runs from point `i - 1` to point `i`, and the points
 * say where it is. Once any segment is fixed the arrow is no longer routed
 * whole: it keeps its interior and only the legs at its ends adapt.
 *
 * Pure: scene-space points in, points out. `binding.ts` converts at the
 * boundary and stores the result.
 */
import type { Point } from './binding';
import { ELBOW_MARGIN, OPPOSITE, VECTOR, headingOf, type ElbowEnd, type Heading } from './elbow';

/** An end of the elbow: bound when it has its shape's box. */
export type SegmentEnd = ElbowEnd;

/** Points and the indices of the segments that stay where they are, sorted. */
export type Shaped = { points: Point[]; fixed: number[] };

/** How far the stub a first or last segment drag inserts stands from its shape. */
const PADDING = ELBOW_MARGIN;

/** Shorter than this, a dragged first or last segment's stub is half of it. */
const SHORT = PADDING + 5;

/** A segment shorter than this is no segment (Excalidraw's `DEDUP_TRESHOLD`). */
const DEGENERATE = 1;

const horizontal = (a: Point, b: Point) => Math.abs(b.y - a.y) <= Math.abs(b.x - a.x);
const onXAxis = (heading: Heading) => heading === 'left' || heading === 'right';
const sorted = (indices: number[]) => [...new Set(indices)].sort((a, b) => a - b);

/**
 * A segment dragged across itself to `coordinate` (its new y when it runs
 * across, its new x when it runs down), from the points and fixed indices at
 * the press, so each frame of the drag starts from the same place. It becomes
 * fixed. The first or last segment takes a stub out from its end first (40,
 * or half the segment when it is shorter than 45, from a bound end), so the
 * arrow still leaves its shape. `index` is where the moved segment is now.
 */
export function moveSegment(
  points: Point[],
  fixed: number[],
  index: number,
  coordinate: number,
  start: SegmentEnd,
  end: SegmentEnd,
): Shaped & { index: number } {
  let out = points.map((point) => ({ ...point }));
  let indices = [...fixed];
  const last = out.length - 1;
  const across = horizontal(out[index - 1], out[index]);
  const length = Math.hypot(out[index].x - out[index - 1].x, out[index].y - out[index - 1].y);
  const pad = length < SHORT ? length / 2 : PADDING;
  const a = out[index - 1];
  const b = out[index];
  if (across) a.y = b.y = coordinate;
  else a.x = b.x = coordinate;

  const origin = points[0];
  const finish = points[last];
  let moved = index;
  if (index === last) {
    // The end's leg runs along its heading when bound, along the dragged
    // segment when free (Excalidraw takes the heading either way, and loses
    // a free end whose segment runs the other way).
    if (end.box) push(b, end.heading, pad);
    const legOnX = end.box ? onXAxis(end.heading) : across;
    const corner = legOnX ? { x: b.x, y: finish.y } : { x: finish.x, y: b.y };
    out.push(corner);
    if (end.box) out.push({ ...finish });
  }
  if (index === 1) {
    if (start.box) push(a, start.heading, pad);
    const legOnX = start.box ? onXAxis(start.heading) : across;
    const corner = legOnX ? { x: a.x, y: origin.y } : { x: origin.x, y: a.y };
    const added = start.box ? [{ ...origin }, corner] : [corner];
    out = [...added, ...out];
    indices = indices.map((i) => i + added.length);
    moved += added.length;
  }
  return { points: out, fixed: sorted([...indices, moved]), index: moved };
}

function push(point: Point, heading: Heading, by: number): void {
  point.x += VECTOR[heading].x * by;
  point.y += VECTOR[heading].y * by;
}

/**
 * The route with its ends where they are now, its fixed interior kept: only
 * the point next to each end is worked out again. Where an end would leave
 * its shape running along the side (its heading on the same axis as the kept
 * segment beyond), two points 40 out are put in instead. The same ends give
 * the same result, so it runs on every change. Null when the route is too
 * short to keep anything, for the caller to route it whole.
 */
export function adaptEnds(points: Point[], fixed: number[], start: SegmentEnd, end: SegmentEnd): Shaped | null {
  const count = points.length;
  const s = stubbed(points[0], points[1], start) ? 1 : 0;
  const e = stubbed(points[count - 1], points[count - 2], end) ? 1 : 0;
  if (count < 4 + s + e) return null;

  const second = points[1 + s];
  const third = points[2 + s];
  const secondToLast = points[count - 2 - e];
  const thirdToLast = points[count - 3 - e];
  const kept = points.slice(2 + s, count - 2 - e);

  const S = start.point;
  const E = end.point;
  let head: Point[];
  let shift = 0;
  const startAcross = horizontal(second, third);
  if (start.box && onXAxis(start.heading) === startAcross) {
    const A = { x: S.x + VECTOR[start.heading].x * PADDING, y: S.y + VECTOR[start.heading].y * PADDING };
    head = [S, A, startAcross ? { x: A.x, y: third.y } : { x: third.x, y: A.y }];
    shift = 1 - s;
  } else {
    head = [S, startAcross ? { x: S.x, y: second.y } : { x: second.x, y: S.y }];
    shift = -s;
  }
  let tail: Point[];
  const endAcross = horizontal(thirdToLast, secondToLast);
  if (end.box && onXAxis(end.heading) === endAcross) {
    const A = { x: E.x + VECTOR[end.heading].x * PADDING, y: E.y + VECTOR[end.heading].y * PADDING };
    tail = [endAcross ? { x: A.x, y: thirdToLast.y } : { x: thirdToLast.x, y: A.y }, A, E];
  } else {
    tail = [endAcross ? { x: E.x, y: secondToLast.y } : { x: secondToLast.x, y: E.y }, E];
  }
  return {
    points: [...head, ...kept, ...tail].map((point) => ({ ...point })),
    fixed: fixed.map((i) => i + shift),
  };
}

/**
 * Whether an end's first leg is a stub put in by `adaptEnds`: a bound end
 * leaving along its heading for exactly the padding. A route's own leg of
 * that length reads the same and gives the same points either way.
 */
function stubbed(at: Point, next: Point, end: SegmentEnd): boolean {
  if (!end.box || !next) return false;
  const along = onXAxis(end.heading) ? next.x - at.x : next.y - at.y;
  const aside = onXAxis(end.heading) ? next.y - at.y : next.x - at.x;
  return Math.abs(aside) < 0.5 && Math.abs(along * (onXAxis(end.heading) ? VECTOR[end.heading].x : VECTOR[end.heading].y) - PADDING) < 0.5;
}

/**
 * A fixed segment let go (a double-click on its handle): the route between
 * its fixed neighbours, or the ends, is worked out again and put in its
 * place; everything beyond them is kept. Null when it was the only fixed
 * segment, for the caller to route the arrow whole.
 */
export function releaseSegment(
  points: Point[],
  fixed: number[],
  index: number,
  start: SegmentEnd,
  end: SegmentEnd,
  route: (from: SegmentEnd, to: SegmentEnd) => number[] | null,
): Shaped | null {
  const left = fixed.filter((i) => i !== index);
  if (left.length === 0) return null;
  const prev = Math.max(0, ...left.filter((i) => i < index));
  const next = Math.min(points.length, ...left.filter((i) => i > index));
  // A free end of the new stretch carries on the way its fixed neighbour
  // runs, so the route cannot turn back on it.
  const travel = (a: Point, b: Point): Heading => headingOf(b.x - a.x, b.y - a.y);
  const from: SegmentEnd = prev > 0 ? { point: points[prev], heading: travel(points[prev - 1], points[prev]) } : start;
  const to: SegmentEnd =
    next < points.length ? { point: points[next - 1], heading: OPPOSITE[travel(points[next - 1], points[next])] } : end;
  const flat = route(from, to) ?? [from.point.x, from.point.y, to.point.x, to.point.y];
  const between: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) between.push({ x: flat[i], y: flat[i + 1] });

  const head = prev > 0 ? points.slice(0, prev + 1) : [];
  const tail = next < points.length ? points.slice(next - 1) : [];
  const middle = between.slice(prev > 0 ? 1 : 0, next < points.length ? -1 : undefined);
  const out = [...head, ...middle, ...tail].map((point) => ({ ...point }));
  const shift = out.length - points.length;
  return renormalise(
    out,
    left.map((i) => (i > index ? i + shift : i)),
  );
}

/**
 * A shaped route tidied, as Excalidraw does on release: a jog shorter than a
 * unit is taken out, a point the route runs straight through is dropped (the
 * merged segment fixed if either part was), and a fixed first or last
 * segment is let go. The same route gives the same result, so it runs on
 * every change. Null when no fixed segment is left.
 */
export function renormalise(points: Point[], fixed: number[]): Shaped | null {
  let out = points.map((point) => ({ ...point }));
  let marks = new Set(fixed);

  // A jog: a segment under a unit between two running the same way. The two
  // become one, on the first one's line; the point after them moves onto it
  // along the segment beyond, which stays square.
  for (let k = 2; k + 1 < out.length; k += 1) {
    const [a, b, c, d] = [out[k - 2], out[k - 1], out[k], out[k + 1]];
    if (Math.hypot(c.x - b.x, c.y - b.y) >= DEGENERATE) continue;
    if (k + 1 === out.length - 1) continue;
    const across = horizontal(a, b);
    if (across !== horizontal(c, d)) continue;
    const moved = across ? { x: d.x, y: a.y } : { x: a.x, y: d.y };
    const wasFixed = marks.has(k - 1) || marks.has(k) || marks.has(k + 1);
    out = [...out.slice(0, k - 1), moved, ...out.slice(k + 2)];
    marks = new Set([...marks].filter((i) => i < k - 1 || i > k + 1).map((i) => (i > k + 1 ? i - 2 : i)));
    if (wasFixed) marks.add(k - 1);
    k -= 1;
  }

  // Straight through: two segments one after the other running the same way.
  for (let i = 1; i + 1 < out.length; i += 1) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    const sameX = Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5;
    const sameY = Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5;
    if (!sameX && !sameY) continue;
    if ((c.x - b.x) * (b.x - a.x) + (c.y - b.y) * (b.y - a.y) < 0) continue;
    const wasFixed = marks.has(i) || marks.has(i + 1);
    out.splice(i, 1);
    marks = new Set([...marks].filter((j) => j !== i && j !== i + 1).map((j) => (j > i + 1 ? j - 1 : j)));
    if (wasFixed) marks.add(i);
    i -= 1;
  }

  const kept = sorted([...marks].filter((i) => i > 1 && i < out.length - 1));
  return kept.length > 0 ? { points: out, fixed: kept } : null;
}
