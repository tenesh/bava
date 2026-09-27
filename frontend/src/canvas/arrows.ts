/**
 * How an arrow is drawn between its two ends: straight, elbow or arc.
 *
 * Pure geometry over the stored `points`, so the routing is tested directly.
 * The file keeps the ends the user drew; the route is derived each time, which
 * is what lets an arrow re-route when it is attached to a shape.
 */
import type { PathSink } from './shapes';
import type { SceneElement } from './scene';
import { wrapLines } from './text-layout';
import { SEGMENT_SAMPLES, smoothPoints } from './curves';
import { LINE_TENSION } from './paint';

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

  // A curve through two points is straight, as Excalidraw's.
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

/** How a head is filled: with the line's colour, the canvas's, or not at all. */
export type HeadFill = 'stroke' | 'surface' | 'none';

/**
 * How big each head is, in scene units, and the half-angle of its barbs, as
 * Excalidraw's `getArrowheadSize` and `getArrowheadAngle`
 * (`element/src/bounds.ts:710-744`).
 */
function headSize(kind: string): number {
  switch (kind) {
    case 'arrow':
      return 25;
    case 'diamond':
    case 'diamond-outline':
      return 12;
    case 'many':
    case 'oneOrMany':
    case 'zeroOrMany':
      return 15;
    case 'one':
    case 'exactlyOne':
    case 'zeroOrOne':
      return 20;
    default:
      return 15;
  }
}

function headAngle(kind: string): number {
  if (kind === 'bar') return 90;
  if (kind === 'arrow') return 20;
  return 25;
}

/** The names a file may give a head; anything else draws as the arrow. */
const KNOWN_HEADS = new Set([
  'arrow', 'bar', 'triangle', 'triangle-outline', 'circle', 'circle-outline', 'diamond', 'diamond-outline',
  'one', 'many', 'oneOrMany', 'exactlyOne', 'zeroOrOne', 'zeroOrMany',
]);

/**
 * Draw an arrowhead into a sink, pointing along +x with its tip at the
 * origin, as Excalidraw draws it (`element/src/shape.ts:290-575`): sized by
 * kind, never more than half the last segment (a quarter for a diamond), a
 * circle growing with the stroke width. Returns how it is filled.
 */
export function drawHead(sink: PathSink, kind: string | undefined, segment: number, strokeWidth: number): HeadFill {
  if (kind === 'none') return 'none';
  const name = kind !== undefined && KNOWN_HEADS.has(kind) ? kind : 'arrow';
  // Where a head of `as` sits, `offset` of its size back from the tip, and its
  // barbs' ends (x3, x4): Excalidraw's `getArrowheadPoints`.
  const place = (as: string, offset = 0) => {
    const multiplier = as === 'diamond' || as === 'diamond-outline' ? 0.25 : 0.5;
    const size = Math.min(headSize(as), segment * multiplier);
    const tip = -size * offset;
    const back = tip - size;
    const turn = (headAngle(as) * Math.PI) / 180;
    // Rotating the back point about the tip by ± the angle.
    const barb = (sign: number) => ({ x: tip - size * Math.cos(turn), y: sign * size * Math.sin(turn) });
    return { size, tip, back, turn, a: barb(-1), b: barb(1) };
  };
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    sink.moveTo(a.x, a.y);
    sink.lineTo(b.x, b.y);
  };
  const toTip = (as: string, offset = 0) => {
    const { tip, a, b } = place(as, offset);
    line(a, { x: tip, y: 0 });
    line(b, { x: tip, y: 0 });
  };
  // Crossing the line: the marker for one.
  const one = (offset = 0) => {
    const { a, b } = place('one', offset);
    line(a, b);
  };
  // A crow's foot: from `size` back, spreading towards the tip.
  const many = () => {
    const { size, back, turn } = place('many');
    const spread = (sign: number) => ({ x: back + size * Math.cos(turn), y: sign * size * Math.sin(turn) });
    line(spread(-1), { x: back, y: 0 });
    line(spread(1), { x: back, y: 0 });
  };
  const ring = (as: string, offset: number, scale: number) => {
    const { size, tip } = place(as, offset);
    const diameter = (size + strokeWidth - 2) * scale;
    circle(sink, tip, 0, diameter / 2);
  };
  switch (name) {
    case 'circle':
    case 'circle-outline':
      ring(name, 0, 1);
      return name === 'circle' ? 'stroke' : 'surface';
    case 'triangle':
    case 'triangle-outline': {
      const { tip, a, b } = place(name);
      sink.moveTo(tip, 0);
      sink.lineTo(a.x, a.y);
      sink.lineTo(b.x, b.y);
      sink.closePath();
      return name === 'triangle' ? 'stroke' : 'surface';
    }
    case 'diamond':
    case 'diamond-outline': {
      const { size, tip, a, b } = place(name);
      sink.moveTo(tip, 0);
      sink.lineTo(a.x, a.y);
      sink.lineTo(tip - size * 2, 0);
      sink.lineTo(b.x, b.y);
      sink.closePath();
      return name === 'diamond' ? 'stroke' : 'surface';
    }
    case 'one':
      one();
      return 'none';
    case 'many':
      many();
      return 'none';
    case 'oneOrMany':
      many();
      one(-0.25);
      return 'none';
    case 'exactlyOne':
      one(-0.5);
      one();
      return 'none';
    case 'zeroOrOne':
      ring('circle-outline', 1.5, 0.8);
      one(-0.5);
      return 'surface';
    case 'zeroOrMany':
      many();
      ring('circle-outline', 1.5, 0.8);
      return 'surface';
    default:
      // The arrow and the bar: two strokes to the tip.
      toTip(name);
      return 'none';
  }
}

/** The length of a route's last segment at one end, which caps its head's size. */
export function endSegment(route: number[], end: 'start' | 'end'): number {
  if (route.length < 4) return 0;
  const [x1, y1, x2, y2] = end === 'start' ? route.slice(0, 4) : route.slice(-4);
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * A head's dash: solid, except a stroke-only head on a dotted line, dotted a
 * little tighter than the line (Excalidraw's `getArrowheadLineOptions`,
 * `element/src/shape.ts:326-343`).
 */
export function headDash(kind: string | undefined, strokeStyle: string | undefined, width: number): number[] {
  if (strokeStyle !== 'dotted' || !headIsStrokes(kind)) return [];
  return [1.5, 4 + width];
}

/** Whether a head is drawn in open strokes only, which a dotted line dots too. */
export function headIsStrokes(kind: string | undefined): boolean {
  return kind === undefined || !KNOWN_HEADS.has(kind) || ['arrow', 'bar', 'one', 'many', 'oneOrMany', 'exactlyOne'].includes(kind);
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
 * Where an arrow's label is centred, in the arrow's own coordinates: where
 * the user slid it (`labelPosition`, along the drawn path's length), or else
 * the middle point, the middle one of an odd number of points or the middle
 * of the middle segment, on the curve for a curved arrow (Excalidraw's
 * `linearElementEditor.ts:1942-1961`). `tension` is the
 * line's smoothing (`hit.ts`, `tensionOf`).
 */
export function labelSpot(element: SceneElement, tension: number, drawn?: number[]): { x: number; y: number } {
  const props = element as SceneElement & { points?: number[]; arrowType?: string; labelPosition?: number };
  const stored = props.points ?? [];
  if (props.labelPosition !== undefined) return labelPoint(drawn ?? pathOf(stored, props.arrowType), props.labelPosition);
  // An elbow's points are its route, so its middle is the route's.
  const points = stored;
  const count = points.length / 2;
  if (count < 2) return { x: points[0] ?? 0, y: points[1] ?? 0 };
  if (count % 2 === 1) {
    const mid = (count - 1) / 2;
    return { x: points[mid * 2], y: points[mid * 2 + 1] };
  }
  const segment = count / 2 - 1;
  const middles = middlesAlong(points, props.arrowType === 'elbow' ? 'straight' : props.arrowType, tension);
  return middles[segment] ?? labelPoint(points);
}

/** An arrow label laid out: centred on `at`, `width` by `height`, turned by `angle` degrees. */
export type LabelLayout = { at: { x: number; y: number }; lines: string[]; width: number; height: number; angle: number };

/**
 * An arrow's label laid out, in the arrow's own coordinates: on its spot
 * (`labelSpot`), wrapped as Excalidraw wraps it, and with
 * `labelDirection: along` turned to the path's direction there, flipped so it
 * never reads upside down. The stage, the exporter and the label
 * editor all lay it out here, so the three agree.
 */
export function labelLayout(
  element: SceneElement,
  drawn: number[],
  tension: number,
  font: { size: number; lineHeight: number },
  measure: (text: string) => number,
  text = (element as { label?: string }).label ?? '',
): LabelLayout {
  const at = labelSpot(element, tension, drawn);
  const lines = wrapLines(text, labelWrapWidth(element, font.size), measure);
  const width = Math.max(0, ...lines.map(measure));
  const height = font.size * font.lineHeight * lines.length;
  const along = (element as { labelDirection?: string }).labelDirection === 'along';
  // Readable on screen, where the arrow's own turn is added to the label's.
  const turn = (element as { angle?: number }).angle ?? 0;
  return { at, lines, width, height, angle: along ? readable(directionAt(drawn, at) + turn) - turn : 0 };
}

/**
 * Where the field for typing an arrow's label sits, in scene space: centred
 * on the label, as wide as the label wraps, at least a line tall, turned with
 * it, not over the arrow's whole box.
 */
export function labelField(
  element: SceneElement,
  drawn: number[],
  tension: number,
  font: { size: number; lineHeight: number },
  measure: (text: string) => number,
): { x: number; y: number; w: number; h: number; angle: number } {
  const layout = labelLayout(element, drawn, tension, font, measure);
  const w = labelWrapWidth(element, font.size);
  const h = Math.max(layout.height, font.size * font.lineHeight);
  // A turned arrow turns its label with it, about the arrow's centre, as its
  // group turns on the canvas.
  const turn = (element as { angle?: number }).angle ?? 0;
  const radians = (turn * Math.PI) / 180;
  const cx = element.x + element.w / 2;
  const cy = element.y + element.h / 2;
  const px = element.x + layout.at.x - cx;
  const py = element.y + layout.at.y - cy;
  const mx = cx + px * Math.cos(radians) - py * Math.sin(radians);
  const my = cy + px * Math.sin(radians) + py * Math.cos(radians);
  return { x: mx - w / 2, y: my - h / 2, w, h, angle: layout.angle + turn };
}

/** The corners of a laid-out label's box grown by `pad`, turned with it: the line's gap. */
export function labelCorners(layout: LabelLayout, pad: number): { x: number; y: number }[] {
  const radians = (layout.angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const hw = layout.width / 2 + pad;
  const hh = layout.height / 2 + pad;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => ({ x: layout.at.x + x * cos - y * sin, y: layout.at.y + x * sin + y * cos }));
}

/** The direction of the path where it passes nearest `at`, in degrees. */
function directionAt(points: number[], at: { x: number; y: number }): number {
  let best = 0;
  let nearest = Infinity;
  for (let i = 0; i + 3 < points.length; i += 2) {
    const [x1, y1, x2, y2] = points.slice(i, i + 4);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = dx * dx + dy * dy;
    if (length === 0) continue;
    const t = Math.max(0, Math.min(1, ((at.x - x1) * dx + (at.y - y1) * dy) / length));
    const distance = Math.hypot(at.x - (x1 + t * dx), at.y - (y1 + t * dy));
    if (distance < nearest) {
      nearest = distance;
      best = (Math.atan2(dy, dx) * 180) / Math.PI;
    }
  }
  return best;
}

/** An angle turned half round when it would put text upside down: within (-90, 90]. */
function readable(angle: number): number {
  let a = ((angle % 360) + 360) % 360;
  if (a > 90 && a <= 270) a -= 180;
  if (a > 270) a -= 360;
  return a;
}

/**
 * How far round an arrow's label its line is hidden, in scene units
 * (Excalidraw's `ARROW_LABEL_CLEARANCE`, `common/src/constants.ts:418`).
 */
export const LABEL_CLEARANCE = 5;

/**
 * How wide an arrow's label wraps: 0.7 of the arrow's width or 11 times the
 * font size, the wider (Excalidraw's `textElement.ts:511-521`).
 */
export function labelWrapWidth(element: SceneElement, fontSize: number): number {
  return Math.max(0.7 * element.w, fontSize * 11);
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
