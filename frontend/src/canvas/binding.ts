/**
 * Arrows attached to shapes: where an attached end touches its target, and
 * what an arrow's points become once its bindings are resolved.
 *
 * A binding is an element id, never a coordinate: ids survive a move and a
 * re-layout, coordinates do not (`docs/file-format.md`). An attached end aims
 * at the target's centre and stops on its outline, a gap clear of it, so
 * moving either shape re-aims the arrow without anything being stored.
 *
 * Pure over scene data, so the geometry is testable without a stage.
 */
import { angleOfElement, centreOf, rotatedBounds, rotatePoint } from './rotate';
import { isOutlineShape, drawOutline, type PathSink } from './shapes';
import type { ElementId, SceneData, SceneElement } from './scene';
import { drawnPathOf, pathBounds } from './hit';
import { tidy } from './resize';
import { headingOf, routeElbow, sideOf, type ElbowEnd, type Heading } from './elbow';
import { routePoints } from './arrows';

export type Point = { x: number; y: number };

/**
 * How far clear of the outline an attached end stops, in scene units. The
 * token is the source; this is the value at the default theme, for the pure
 * functions below, which take no reader (`--size-binding-gap`).
 */
export const BINDING_GAP = 4;

type Bound = { startBinding?: string; endBinding?: string };

/** The elements an arrow is attached to, by end. */
export function bindingsOf(arrow: SceneElement): { start?: string; end?: string } {
  const bound = arrow as SceneElement & Bound;
  return { start: bound.startBinding, end: bound.endBinding };
}

/** Whether either end names an element the scene no longer has. */
export function isDetached(arrow: SceneElement, scene: SceneData): boolean {
  const { start, end } = bindingsOf(arrow);
  const has = (id?: string) => id === undefined || scene.elements.some((e) => e.id === id);
  return !has(start) || !has(end);
}

/**
 * Where an attached end sits: where the ray from `from` (the end's anchor on
 * the shape, its centre when it has none) towards `towards` (the end's
 * neighbour) leaves `shape`'s outline, pushed `BINDING_GAP` further out.
 *
 * The outline is the one that is drawn: an ellipse's curve, a polygon's edges
 * through `shapes.ts`, a box otherwise, each turned by the shape's angle. The
 * exit furthest along the ray is taken, so an anchor on the outline itself
 * still leaves by the far side of anything in the way. A ray with no
 * direction, or one that never meets the outline, leaves the end at `from`,
 * which the caller treats as having nowhere to go.
 */
export function anchorOn(shape: SceneElement, towards: Point, from: Point = centreOf(shape)): Point {
  const dx = towards.x - from.x;
  const dy = towards.y - from.y;
  if (dx === 0 && dy === 0) return from;

  const centre = centreOf(shape);
  const angle = angleOfElement(shape);
  // Work in the shape's own frame, centred on its middle, where its outline is
  // upright; then turn the answer back.
  const localFrom = rotatePoint(from, centre, -angle);
  const localTowards = rotatePoint(towards, centre, -angle);
  const origin = { x: localFrom.x - centre.x, y: localFrom.y - centre.y };
  const direction = { x: localTowards.x - localFrom.x, y: localTowards.y - localFrom.y };
  const t = exitAlong(shape, origin, direction);
  if (t === null) {
    // A spot outside the drawn outline (a stored anchor by an ellipse's box
    // corner) whose ray points away: aim from the centre instead, so an
    // attached end always lands on its shape and follows it.
    return from.x === centre.x && from.y === centre.y ? from : anchorOn(shape, towards, centre);
  }

  const length = Math.hypot(direction.x, direction.y);
  const out = {
    x: centre.x + origin.x + direction.x * t + (direction.x / length) * BINDING_GAP,
    y: centre.y + origin.y + direction.y * t + (direction.y / length) * BINDING_GAP,
  };
  return rotatePoint(out, centre, angle);
}

/**
 * The spot an anchor names on `shape`, in scene space: a fraction of its
 * upright box, turned with it. No anchor is the centre.
 */
export function spotOn(shape: SceneElement, anchor: [number, number] | undefined): Point {
  const centre = centreOf(shape);
  if (!anchor) return centre;
  const point = { x: shape.x + anchor[0] * shape.w, y: shape.y + anchor[1] * shape.h };
  return rotatePoint(point, centre, angleOfElement(shape));
}

/**
 * How far along `direction` (as a multiple of it) a ray from `origin` last
 * crosses the outline, in the shape's own centred frame; null if it never
 * does ahead of the origin.
 */
function exitAlong(shape: SceneElement, origin: Point, direction: Point): number | null {
  const halfW = shape.w / 2;
  const halfH = shape.h / 2;
  if (halfW <= 0 || halfH <= 0) return null;

  if (shape.type === 'ellipse') {
    // (x/a)² + (y/b)² = 1 along origin + t·direction: a quadratic in t.
    const a = (direction.x / halfW) ** 2 + (direction.y / halfH) ** 2;
    const b = 2 * ((origin.x * direction.x) / halfW ** 2 + (origin.y * direction.y) / halfH ** 2);
    const c = (origin.x / halfW) ** 2 + (origin.y / halfH) ** 2 - 1;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const t = (-b + Math.sqrt(discriminant)) / (2 * a);
    return t >= 0 ? t : null;
  }

  const corners = isOutlineShape(shape.type)
    ? outlinePoints(shape).map((p) => ({ x: p.x - halfW, y: p.y - halfH }))
    : [
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH },
      ];
  let furthest: number | null = null;
  for (let i = 0; i < corners.length; i += 1) {
    const t = rayMeetsSegment(origin, direction, corners[i], corners[(i + 1) % corners.length]);
    if (t !== null && (furthest === null || t > furthest)) furthest = t;
  }
  return furthest;
}

/** Where a ray meets a segment, as a multiple of the ray's direction, or null. */
function rayMeetsSegment(origin: Point, direction: Point, c: Point, d: Point): number | null {
  const edge = { x: d.x - c.x, y: d.y - c.y };
  const denominator = direction.x * edge.y - direction.y * edge.x;
  if (denominator === 0) return null;
  const t = ((c.x - origin.x) * edge.y - (c.y - origin.y) * edge.x) / denominator;
  const u = ((c.x - origin.x) * direction.y - (c.y - origin.y) * direction.x) / denominator;
  if (t < 0 || u < 0 || u > 1) return null;
  return t;
}

/** The outline's corners, collected from the same code the canvas draws with. */
function outlinePoints(shape: SceneElement): Point[] {
  const points: Point[] = [];
  const record = (...args: number[]) => {
    for (let i = 0; i + 1 < args.length; i += 2) points.push({ x: args[i], y: args[i + 1] });
  };
  const sink: PathSink = { moveTo: record, lineTo: record, bezierCurveTo: record, closePath: () => {} };
  if (isOutlineShape(shape.type)) drawOutline(shape.type, sink, shape.w, shape.h, 0);
  return points;
}

/**
 * An arrow's points with each attached end moved onto its target, relative to
 * the arrow's own `x, y` as the file stores them. An end whose binding cannot
 * be resolved keeps the point it was drawn with: the endpoint freezes rather
 * than the arrow moving or disappearing.
 */
export function routeFor(arrow: SceneElement, scene: SceneData): number[] {
  const points = [...(('points' in arrow ? arrow.points : []) as number[])];
  if (points.length < 4) return points;

  const { start, end } = bindingsOf(arrow);
  const find = (id?: string) => (id === undefined ? undefined : scene.elements.find((e) => e.id === id));
  const startShape = find(start);
  const endShape = find(end);
  if ((arrow as SceneElement & { arrowType?: string }).arrowType === 'elbow') return elbowRoute(arrow, points, startShape, endShape);
  if (!startShape && !endShape) return points;

  // Each end aims through its anchor (its shape's centre without one) at its
  // neighbour: the nearest bend, or with none, the other end, taken as that
  // end's own anchor when it is attached.
  const bound = arrow as SceneElement & { startAnchor?: [number, number]; endAnchor?: [number, number] };
  const world = (index: number): Point => ({ x: arrow.x + points[index], y: arrow.y + points[index + 1] });
  const last = points.length - 2;
  const bent = points.length > 4;
  const startSpot = startShape ? spotOn(startShape, bound.startAnchor) : world(0);
  const endSpot = endShape ? spotOn(endShape, bound.endAnchor) : world(last);
  const startTarget = bent ? world(2) : endSpot;
  const endTarget = bent ? world(last - 2) : startSpot;

  // An end aimed at its own spot has no direction to leave by, and anchoring
  // it there would collapse the arrow to a point. It keeps the point it was
  // drawn with until its neighbour moves somewhere else.
  const place = (shape: SceneElement, spot: Point, towards: Point, index: number) => {
    const anchor = anchorOn(shape, towards, spot);
    if (anchor.x === spot.x && anchor.y === spot.y) return;
    points[index] = anchor.x - arrow.x;
    points[index + 1] = anchor.y - arrow.y;
  };
  if (startShape) place(startShape, startSpot, startTarget, 0);
  if (endShape) place(endShape, endSpot, endTarget, last);
  return points;
}

/** The least reach, in scene units, at 100% zoom and closer (Excalidraw's). */
export const BINDING_REACH_MIN = 15;
/** The most reach, in scene units, however far the view zooms out. */
export const BINDING_REACH_MAX = 30;

/**
 * How near an end must come to a shape's outline to attach, in scene units,
 * at `zoom`: Excalidraw's `maxBindingDistance_simple`, which reaches further
 * as the view zooms out and never less than at 100%.
 */
export function bindingReach(zoom: number): number {
  const scale = zoom > 0 && zoom < 1 ? zoom : 1;
  return Math.min(BINDING_REACH_MAX, Math.max(BINDING_REACH_MIN, BINDING_REACH_MIN / (scale * 1.5)));
}

/**
 * An elbow arrow's route, relative to the arrow as the file stores points
 * (`docs/file-format.md`): each attached end stays on the side its anchor is
 * on, where the anchor meets the outline a gap clear, and leaves outward from
 * it; a free end stays where it is and faces the other end. The route goes
 * around both shapes (`elbow.ts`). Where none exists, today's plain Z.
 */
function elbowRoute(arrow: SceneElement, points: number[], startShape?: SceneElement, endShape?: SceneElement): number[] {
  const bound = arrow as SceneElement & { startAnchor?: [number, number]; endAnchor?: [number, number] };
  const last = points.length - 2;
  const freeStart = { x: arrow.x + points[0], y: arrow.y + points[1] };
  const freeEnd = { x: arrow.x + points[last], y: arrow.y + points[last + 1] };
  // Where each end is aimed from: its shape's anchor spot, or the free point.
  const startSpot = startShape ? spotOn(startShape, bound.startAnchor) : freeStart;
  const endSpot = endShape ? spotOn(endShape, bound.endAnchor) : freeEnd;

  const end = (shape: SceneElement | undefined, anchor: [number, number] | undefined, spot: Point, other: Point, free: Point): ElbowEnd => {
    if (!shape) return { point: free, heading: headingOf(other.x - free.x, other.y - free.y) };
    // The side the anchor is on, in the shape's own frame, turned with the
    // shape to face where it is drawn; the centre (no anchor) faces the other
    // end. The route leaves along the nearest screen axis.
    const side = sideOf(anchor ?? [0.5, 0.5]);
    const outward = side
      ? rotatePoint(ELBOW_DIRECTION[side], { x: 0, y: 0 }, angleOfElement(shape))
      : { x: other.x - spot.x, y: other.y - spot.y };
    const heading = headingOf(outward.x, outward.y);
    const out = { x: spot.x + outward.x * 1e5, y: spot.y + outward.y * 1e5 };
    return { point: anchorOn(shape, out, spot), heading, box: rotatedBounds(shape) };
  };
  const from = end(startShape, bound.startAnchor, startSpot, endSpot, freeStart);
  const to = end(endShape, bound.endAnchor, endSpot, startSpot, freeEnd);
  // Re-aiming runs on every change and every preview frame, for every elbow;
  // a route is only worked out again when what it depends on moved.
  const key = JSON.stringify([from, to]);
  let route = routed.get(key);
  if (!route) {
    route = routeElbow(from, to, { gap: BINDING_GAP }) ?? zRoute(from.point, to.point);
    if (routed.size >= ROUTE_CACHE_SIZE) routed.clear();
    routed.set(key, route);
  }
  return route.map((value, i) => value - (i % 2 === 0 ? arrow.x : arrow.y));
}

/** Routes already worked out, by their ends, headings and shapes' boxes. */
const routed = new Map<string, number[]>();

/** Enough for every elbow in a large scene, twice over; cleared when full. */
const ROUTE_CACHE_SIZE = 2000;

/** The plain Z an elbow falls back on: along the longer axis, turning at the middle. */
function zRoute(a: Point, b: Point): number[] {
  return routePoints([a.x, a.y, b.x, b.y], 'elbow');
}

const ELBOW_DIRECTION: Record<Heading, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/**
 * The element an arrow end dropped at `point` should attach to, if any.
 *
 * Found by its drawn outline, not its box: the eligible element the point is
 * inside, the smallest if several (a small shape within a big one), or else
 * the one whose outline is nearest, within `reach` scene units. Excalidraw's
 * rule; strict containment made an end dropped just short of an edge let go.
 *
 * A frame is not a target: an arrow drawn inside one would otherwise attach to
 * the container rather than to the shape the user aimed at. Neither is a
 * group, which draws nothing, nor another linear element, which has no
 * outline to anchor on.
 */
export function targetAt(scene: SceneData, point: Point, exclude: ElementId, reach = BINDING_REACH_MIN): SceneElement | undefined {
  let chosen: SceneElement | undefined;
  for (const element of scene.elements) {
    if (element.id === exclude || NEVER_A_TARGET.has(element.type) || element.locked === true) continue;
    // Cheap first: a point beyond the box grown by the reach cannot be near
    // the outline inside it. This runs on every move while an end is dragged.
    const box = rotatedBounds(element);
    if (point.x < box.x - reach || point.x > box.x + box.w + reach || point.y < box.y - reach || point.y > box.y + box.h + reach) {
      continue;
    }
    const { contains, distance } = measureAgainst(element, point);
    if (!contains && distance > reach) continue;
    // The smallest of everything in reach, inside or out, as Excalidraw
    // prefers: a small shape inside a big one wins from just outside it too.
    // Later is higher, so between equal areas the one on top.
    if (!chosen || element.w * element.h <= chosen.w * chosen.h) chosen = element;
  }
  return chosen;
}

/** The middles of a box's sides, as anchors: top, right, bottom, left. */
const SIDE_MIDDLES: [number, number][] = [
  [0.5, 0],
  [1, 0.5],
  [0.5, 1],
  [0, 0.5],
];

/**
 * The anchor for an end dropped at `point` on `shape`: where it landed, as a
 * fraction of the shape's upright box, clamped to it. Dropped outside the
 * shape within `reach` of a side's middle, it snaps to that middle
 * (Excalidraw's `getSnapOutlineMidPoint` for ordinary arrows).
 */
export function anchorFor(shape: SceneElement, point: Point, reach = BINDING_REACH_MIN): [number, number] {
  if (!measureAgainst(shape, point).contains) {
    // The nearest middle in reach, not the first: on a small shape several
    // are in reach at once.
    let best: [number, number] | null = null;
    let bestDistance = reach;
    for (const middle of SIDE_MIDDLES) {
      const at = spotOn(shape, middle);
      const distance = Math.hypot(at.x - point.x, at.y - point.y);
      if (distance <= bestDistance) {
        best = middle;
        bestDistance = distance;
      }
    }
    if (best) return best;
  }
  const centre = centreOf(shape);
  const upright = rotatePoint(point, centre, -angleOfElement(shape));
  let local = { x: upright.x - centre.x, y: upright.y - centre.y };
  // A spot outside the drawn outline (by an ellipse's or a diamond's box
  // corner) is taken to the nearest point on it, so the end aims through
  // somewhere on the shape.
  const outline = outlineOf(shape);
  if (!insidePolygon(outline, local)) local = nearestOn(outline, local);
  const fraction = (value: number, size: number) => (size > 0 ? tidy(Math.min(1, Math.max(0, value / size + 0.5))) : 0.5);
  return [fraction(local.x, shape.w), fraction(local.y, shape.h)];
}

/** Whether a point is inside an element's drawn outline, and how far from it. */
function measureAgainst(shape: SceneElement, point: Point): { contains: boolean; distance: number } {
  const centre = centreOf(shape);
  const local = rotatePoint(point, centre, -angleOfElement(shape));
  const p = { x: local.x - centre.x, y: local.y - centre.y };
  const outline = outlineOf(shape);
  if (outline.length < 3) return { contains: false, distance: Infinity };
  let distance = Infinity;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) distance = Math.min(distance, toSegment(p, outline[i], outline[j]));
  return { contains: insidePolygon(outline, p), distance };
}

/** Whether a point is inside a polygon, by crossings. */
function insidePolygon(outline: Point[], p: Point): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const a = outline[i];
    const b = outline[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The point on a polygon's edges nearest `p`. */
function nearestOn(outline: Point[], p: Point): Point {
  let best = p;
  let bestDistance = Infinity;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const a = outline[j];
    const b = outline[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
    const at = { x: a.x + t * dx, y: a.y + t * dy };
    const distance = Math.hypot(p.x - at.x, p.y - at.y);
    if (distance < bestDistance) {
      best = at;
      bestDistance = distance;
    }
  }
  return best;
}

/** Enough sides that an ellipse's outline is within a fraction of a unit. */
const ELLIPSE_SIDES = 48;

/** The drawn outline as a polygon, in the shape's own centred, upright frame. */
function outlineOf(shape: SceneElement): Point[] {
  const halfW = shape.w / 2;
  const halfH = shape.h / 2;
  if (shape.type === 'ellipse') {
    return Array.from({ length: ELLIPSE_SIDES }, (_, i) => {
      const angle = (i / ELLIPSE_SIDES) * Math.PI * 2;
      return { x: Math.cos(angle) * halfW, y: Math.sin(angle) * halfH };
    });
  }
  if (isOutlineShape(shape.type)) return outlinePoints(shape).map((p) => ({ x: p.x - halfW, y: p.y - halfH }));
  return [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: -halfW, y: halfH },
  ];
}

/** A point's distance from a segment. */
function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

const NEVER_A_TARGET = new Set(['arrow', 'line', 'stroke', 'group', 'frame']);

/**
 * Re-aim every attached arrow in `scene`, in place.
 *
 * One pass, applied after any change to geometry, so no edit path can forget
 * it: a drag, a resize, a rotation, an align, a nudge and an undo all end
 * here. An arrow's box is kept around the points it draws, because selection,
 * the marquee and the eraser test that box.
 */
export function reroute(scene: SceneData): void {
  for (let i = 0; i < scene.elements.length; i += 1) {
    const element = scene.elements[i];
    if (element.type !== 'arrow') continue;

    const routed = routeFor(element, scene);
    const { start, end } = bindingsOf(element);
    const attached = start !== undefined || end !== undefined;
    // An attached arrow's direction comes from the shapes it joins, so a
    // stored angle has nothing left to mean: keeping it would turn the arrow
    // away from the anchors just computed for it.
    const upright = attached && angleOfElement(element) !== 0 ? stripAngle(element) : element;
    const settled = settledAround(upright, routed);
    if (!changed(element, settled)) continue;
    scene.elements[i] = settled;
  }
}

/**
 * A line's or arrow's points where they are drawn, in scene space: its stored
 * points turned by its angle about its centre. What handles sit on and what
 * a press is compared with.
 */
export function drawnPoints(element: SceneElement): number[] {
  const points = ('points' in element ? element.points : []) as number[];
  const angle = angleOfElement(element);
  const centre = centreOf(element);
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const at = rotatePoint({ x: element.x + points[i], y: element.y + points[i + 1] }, centre, angle);
    out.push(at.x, at.y);
  }
  return out;
}

/**
 * A turned line or arrow with its turn written into its points: drawn exactly
 * the same, with no angle. A polyline loses nothing by it, and a bend or an
 * end edited in scene space then means what it says; editing points under an
 * angle moves the pivot and makes the drawing jump.
 */
export function unturned(element: SceneElement): SceneElement {
  if (angleOfElement(element) === 0) return element;
  return settledAround({ ...stripAngle(element), x: 0, y: 0 } as SceneElement, drawnPoints(element));
}

/** The element without its angle, for an arrow whose ends are anchored. */
function stripAngle(element: SceneElement): SceneElement {
  const copy = { ...element } as SceneElement & { angle?: number };
  delete copy.angle;
  return copy;
}

function changed(before: SceneElement, after: SceneElement): boolean {
  const points = (e: SceneElement) => (('points' in e ? e.points : []) as number[]).join();
  return (
    (before as { angle?: number }).angle !== (after as { angle?: number }).angle ||
    before.x !== after.x ||
    before.y !== after.y ||
    before.w !== after.w ||
    before.h !== after.h ||
    points(before) !== points(after)
  );
}

/**
 * An arrow with new points, its box put back around what it *draws*.
 *
 * An elbow's corners and an arc's bow leave the straight line between the
 * ends, so a box taken from the stored points alone cuts the curve off, and
 * selection, the marquee, the eraser and the export bounds all inherit that.
 */
export function settledAround(arrow: SceneElement, points: number[]): SceneElement {
  if (points.length < 4) return arrow;
  const drawn = pathBounds(drawnPathOf({ ...arrow, x: 0, y: 0, angle: 0, points } as SceneElement));
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const left = Math.min(drawn.x, ...xs);
  const top = Math.min(drawn.y, ...ys);
  const right = Math.max(drawn.x + drawn.w, ...xs);
  const bottom = Math.max(drawn.y + drawn.h, ...ys);
  return {
    ...arrow,
    // The points are relative to x, y: shifting the box shifts them back.
    x: tidy(arrow.x + left),
    y: tidy(arrow.y + top),
    w: tidy(right - left),
    h: tidy(bottom - top),
    points: points.map((value, i) => tidy(value - (i % 2 === 0 ? left : top))),
  } as SceneElement;
}
