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
import { isShapeType, type ElementId, type SceneData, type SceneElement } from './scene';
import { drawnPathOf, pathBounds } from './hit';
import { tidy } from './resize';
import { headingOf, routeElbow, sideOf, type ElbowEnd, type Heading } from './elbow';
import { adaptEnds, renormalise } from './elbow-segments';
import { routePoints } from './arrows';

export type Point = { x: number; y: number };

/**
 * How far clear of the outline an attached end stops, in scene units:
 * Excalidraw's 5 plus half the shape's stroke width (`getBindingGap`,
 * `element/src/binding.ts:117`, `:125-131`). This is its value for a shape at
 * the default width; `gapOf` gives any shape's.
 */
export const BINDING_GAP = 6;

/** The gap an end keeps from `shape`'s outline (`BINDING_GAP` at the default width). */
export function gapOf(shape?: SceneElement): number {
  return 5 + (shape ? strokeOf(shape) : 2) / 2;
}

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
    x: centre.x + origin.x + direction.x * t + (direction.x / length) * gapOf(shape),
    y: centre.y + origin.y + direction.y * t + (direction.y / length) * gapOf(shape),
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
  const bound = arrow as SceneElement & {
    startAnchor?: [number, number];
    endAnchor?: [number, number];
    startMode?: string;
    endMode?: string;
  };
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
  // An end whose outline point falls inside the other, overlapping shape
  // would turn the arrow inside out: it sits at its anchor instead
  // (Excalidraw's `element/src/binding.ts:2037-2094`).
  const place = (shape: SceneElement, spot: Point, towards: Point, index: number) => {
    const anchor = anchorOn(shape, towards, spot);
    if (anchor.x === spot.x && anchor.y === spot.y) return;
    const other = shape === startShape ? endShape : startShape;
    // Only between shapes of like size: a child's arrow to its container
    // still leaves the child's edge (Excalidraw's area test, and its gap as
    // the reach of "inside").
    const inverts =
      other !== undefined &&
      other !== shape &&
      other.w * other.h < shape.w * shape.h * 2 &&
      (() => {
        const { contains, distance } = measureAgainst(other, anchor);
        return contains || distance <= gapOf(other);
      })();
    const at = inverts ? spot : anchor;
    points[index] = at.x - arrow.x;
    points[index + 1] = at.y - arrow.y;
  };
  // A pinned end sits at its spot, inside the shape (`mode: "inside"`).
  const pin = (spot: Point, index: number) => {
    points[index] = spot.x - arrow.x;
    points[index + 1] = spot.y - arrow.y;
  };
  if (startShape) {
    if (bound.startMode === 'inside') pin(startSpot, 0);
    else place(startShape, startSpot, startTarget, 0);
  }
  if (endShape) {
    if (bound.endMode === 'inside') pin(endSpot, last);
    else place(endShape, endSpot, endTarget, last);
  }
  // Shorter than the least an arrow can be, its edge ends fall back to their
  // anchors too (Excalidraw's `BASE_ARROW_MIN_LENGTH`).
  if (Math.hypot(points[last] - points[0], points[last + 1] - points[1]) < MIN_ARROW_LENGTH) {
    if (startShape && bound.startMode !== 'inside') pin(startSpot, 0);
    if (endShape && bound.endMode !== 'inside') pin(endSpot, last);
  }
  return points;
}

/** The shortest an attached arrow's ends may be apart, in scene units (Excalidraw's 10). */
const MIN_ARROW_LENGTH = 10;

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
  const { from, to } = elbowEnds(arrow, points, startShape, endShape);
  // Re-aiming runs on every change and every preview frame, for every elbow;
  // a route is only worked out again when what it depends on moved.
  const key = JSON.stringify([from, to]);
  let route = routed.get(key);
  if (!route) {
    route = routeElbow(from, to, { gap: Math.max(gapOf(startShape), gapOf(endShape)) }) ?? zRoute(from.point, to.point);
    if (routed.size >= ROUTE_CACHE_SIZE) routed.clear();
    routed.set(key, route);
  }
  return route.map((value, i) => value - (i % 2 === 0 ? arrow.x : arrow.y));
}

/**
 * Where an elbow's ends are and which way each leaves, in scene space: an
 * attached end on the side its anchor is on, a gap clear of the outline; a
 * free end where it is, facing the other.
 */
export function elbowEnds(
  arrow: SceneElement,
  points: number[],
  startShape?: SceneElement,
  endShape?: SceneElement,
): { from: ElbowEnd; to: ElbowEnd } {
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
  return {
    from: end(startShape, bound.startAnchor, startSpot, endSpot, freeStart),
    to: end(endShape, bound.endAnchor, endSpot, startSpot, freeEnd),
  };
}

/**
 * An elbow with fixed segments (`fixedSegments`): its interior kept, the legs
 * at its ends worked out again (`elbow-segments.ts`), relative to the arrow
 * as its points are. Null when nothing fixed survives, for a whole route.
 */
function shapedRoute(arrow: SceneElement, scene: SceneData): { points: number[]; fixed: number[] } | null {
  const fixed = fixedOf(arrow);
  const points = ('points' in arrow ? arrow.points : []) as number[];
  if (fixed.length === 0 || points.length < 8) return null;
  const { start, end } = bindingsOf(arrow);
  const find = (id?: string) => (id === undefined ? undefined : scene.elements.find((e) => e.id === id));
  const { from, to } = elbowEnds(arrow, points, find(start), find(end));
  const world: Point[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) world.push({ x: arrow.x + points[i], y: arrow.y + points[i + 1] });
  const adapted = adaptEnds(world, fixed, from, to);
  const tidied = adapted && renormalise(adapted.points, adapted.fixed);
  if (!tidied) return null;
  return { points: tidied.points.flatMap((p) => [p.x - arrow.x, p.y - arrow.y]), fixed: tidied.fixed };
}

/** The indices of an elbow's fixed segments, sorted; none when it has none. */
export function fixedOf(arrow: SceneElement): number[] {
  const list = (arrow as { fixedSegments?: { index?: unknown }[] }).fixedSegments;
  if (!Array.isArray(list)) return [];
  const indices = list.map((entry) => entry?.index).filter((i): i is number => typeof i === 'number' && Number.isInteger(i));
  return [...new Set(indices)].sort((a, b) => a - b);
}

/**
 * The arrow with its fixed segments set to `fixed`, each entry's ends read
 * from its points; the key removed when there are none.
 */
export function withFixed(arrow: SceneElement, fixed: number[]): SceneElement {
  const points = ('points' in arrow ? arrow.points : []) as number[];
  const out = { ...arrow } as SceneElement & { fixedSegments?: unknown };
  const valid = fixed.filter((i) => i > 1 && i < points.length / 2 - 1);
  if (valid.length === 0) delete out.fixedSegments;
  else
    out.fixedSegments = valid.map((index) => ({
      index,
      start: [points[index * 2 - 2], points[index * 2 - 1]],
      end: [points[index * 2], points[index * 2 + 1]],
    }));
  return out;
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
  // Front to back, as Excalidraw's `getBindingCandidates`
  // (`element/src/collision.ts:346-404`): a shape holding the point hides
  // everything behind it, locked or not, and a locked one is never a target.
  const candidates: { element: SceneElement; distance: number }[] = [];
  const ordered = [...scene.elements].sort((a, b) => b.z - a.z);
  for (const element of ordered) {
    if (element.id === exclude || NEVER_A_TARGET.has(element.type)) continue;
    // Cheap first: a point beyond the box grown by the reach cannot be near
    // the outline inside it. This runs on every move while an end is dragged.
    const box = rotatedBounds(element);
    if (point.x < box.x - reach || point.x > box.x + box.w + reach || point.y < box.y - reach || point.y > box.y + box.h + reach) {
      continue;
    }
    const { contains, distance } = measureAgainst(element, point);
    // A frame is attached to from outside only: an end inside one goes to
    // what is in it.
    if (element.type === 'frame' && contains) continue;
    if (!contains && distance > reach) continue;
    // Positive inside, negative outside, as Excalidraw measures.
    if (element.locked !== true) candidates.push({ element, distance: contains ? distance : -distance });
    if (contains && opaque(element)) break;
  }
  if (candidates.length <= 1) return candidates[0]?.element;
  // The nearest outline wins, unless the point is inside it and inside a
  // smaller element overlapping it (over a quarter of that one, under three
  // quarters of the nearest's size), which then wins.
  candidates.sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));
  const nearest = candidates[0];
  if (nearest.distance < 0) return nearest.element;
  const near = rotatedBounds(nearest.element);
  const nearArea = Math.max(0.00001, near.w * near.h);
  const smaller = candidates.slice(1).find(({ element, distance }) => {
    if (distance < 0) return false;
    const b = rotatedBounds(element);
    const overlap =
      Math.max(0, Math.min(b.x + b.w, near.x + near.w) - Math.max(b.x, near.x)) *
      Math.max(0, Math.min(b.y + b.h, near.y + near.h) - Math.max(b.y, near.y));
    const area = Math.max(0.00001, b.w * b.h);
    return overlap / area > 0.25 && area / nearArea < 0.75;
  });
  return (smaller ?? nearest).element;
}

/**
 * Whether an element hides what is behind it from attaching: a shape or a
 * code block, which Bava always fills; text and frames do not.
 */
function opaque(element: SceneElement): boolean {
  return isShapeType(element.type) || element.type === 'code';
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
 * (Excalidraw's `getSnapOutlineMidPoint` for ordinary arrows). An `inside`
 * (pinned) end keeps the exact spot, neither snapped nor taken to the outline.
 * An `elbow` end snaps by the elbow's own rule (`elbowSnap`) and is never
 * pinned.
 */
export function anchorFor(
  shape: SceneElement,
  point: Point,
  reach = BINDING_REACH_MIN,
  inside = false,
  elbow = false,
  from?: Point,
  snap = true,
): [number, number] {
  if (elbow) {
    const snapped = snap ? elbowSnap(shape, point, reach) : null;
    if (snapped) return snapped;
    inside = false;
  } else if (!inside && !measureAgainst(shape, point).contains) {
    // A side's middle within reach plus half the stroke width (Excalidraw's
    // `getSnapOutlineMidPoint`); off with Shift or the setting.
    const best = snap ? nearestMiddle(shape, point, reach + strokeOf(shape) / 2) : null;
    if (best) return best.anchor;
    // Carried onto the shape's nearer diagonal along the line from the other
    // end, so the end keeps aiming the same way when the shape moves.
    const projected = from ? ontoDiagonal(shape, point, from) : null;
    if (projected) return projected;
  }
  const centre = centreOf(shape);
  const upright = rotatePoint(point, centre, -angleOfElement(shape));
  let local = { x: upright.x - centre.x, y: upright.y - centre.y };
  // A spot outside the drawn outline (by an ellipse's or a diamond's box
  // corner) is taken to the nearest point on it, so the end aims through
  // somewhere on the shape.
  // A pinned end keeps exactly where it landed.
  const outline = outlineOf(shape);
  if (!inside && !insidePolygon(outline, local)) local = nearestOn(outline, local);
  const fraction = (value: number, size: number) => (size > 0 ? tidy(Math.min(1, Math.max(0, value / size + 0.5))) : 0.5);
  return [fraction(local.x, shape.w), fraction(local.y, shape.h)];
}

/** Where an elbow end snaps to a diamond's edge middles, and which way from them. */
const DIAMOND_EDGE_MIDDLES: [number, number, number, number][] = [
  [0.25, 0.25, -1, -1],
  [0.75, 0.25, 1, -1],
  [0.25, 0.75, -1, 1],
  [0.75, 0.75, 1, 1],
];

/** The share of a side, either way of its middle, an elbow end snaps within. */
const ELBOW_SNAP_BAND = 0.05;

/**
 * Excalidraw's elbow snap (`getElbowArrowSnapMidPoint`, `utils.ts:640-786`):
 * a point within a band either side of the line through the centre, 5% of
 * the side and clamped between 5 and `reach`, snaps to the middle of the side
 * it is towards, from inside the shape or out; on a diamond, a point near an
 * edge's middle (a gap outside it) snaps there. Null when neither.
 */
function elbowSnap(shape: SceneElement, point: Point, reach: number): [number, number] | null {
  const centre = centreOf(shape);
  const upright = rotatePoint(point, centre, -angleOfElement(shape));
  const dx = upright.x - centre.x;
  const dy = upright.y - centre.y;
  const gap = gapOf(shape);
  if (Math.hypot(dx, dy) < gap) return null;
  const clamp = (value: number) => Math.min(reach, Math.max(5, value));
  const across = clamp(ELBOW_SNAP_BAND * shape.w);
  const down = clamp(ELBOW_SNAP_BAND * shape.h);
  if (dx <= 0 && Math.abs(dy) < down) return [0, 0.5];
  if (dy <= 0 && Math.abs(dx) < across) return [0.5, 0];
  if (dx >= 0 && Math.abs(dy) < down) return [1, 0.5];
  if (dy >= 0 && Math.abs(dx) < across) return [0.5, 1];
  if (shape.type === 'diamond') {
    const within = Math.max(across, down);
    for (const [fx, fy, sx, sy] of DIAMOND_EDGE_MIDDLES) {
      const zone = { x: shape.x + fx * shape.w + sx * gap, y: shape.y + fy * shape.h + sy * gap };
      if (Math.hypot(zone.x - upright.x, zone.y - upright.y) < within) return [fx, fy];
    }
  }
  return null;
}

/**
 * The spots an elbow end can snap to on a shape, in scene space, for the
 * stage to show as dots while an elbow end is dragged: the four side middles
 * (a diamond's corners), and a diamond's edge middles too.
 */
export function elbowSnapSpots(shape: SceneElement): Point[] {
  const edges: [number, number][] = shape.type === 'diamond' ? DIAMOND_EDGE_MIDDLES.map(([fx, fy]) => [fx, fy]) : [];
  return [...SIDE_MIDDLES, ...edges].map((middle) => spotOn(shape, middle));
}

/**
 * The drop point carried along the line from `from` onto the nearer of the
 * shape's diagonals (centre lines for a curved or pointed shape), as a
 * fraction of its box; null when the arrow has no length to aim by or the
 * point found is off the shape (Excalidraw's `projectFixedPointOntoDiagonal`).
 */
function ontoDiagonal(shape: SceneElement, point: Point, from: Point): [number, number] | null {
  if (Math.abs(point.x - from.x) < 3 && Math.abs(point.y - from.y) < 3) return null;
  const centre = centreOf(shape);
  const angle = angleOfElement(shape);
  const a = rotatePoint(from, centre, -angle);
  const p = rotatePoint(point, centre, -angle);
  const { x, y, w, h } = shape;
  const boxy = shape.type === 'rect' || shape.type === 'code' || shape.type === 'text' || shape.type === 'frame';
  const lines: [Point, Point][] = boxy
    ? [
        [{ x, y }, { x: x + w, y: y + h }],
        [{ x: x + w, y }, { x, y: y + h }],
      ]
    : [
        [{ x, y: y + h / 2 }, { x: x + w, y: y + h / 2 }],
        [{ x: x + w / 2, y }, { x: x + w / 2, y: y + h }],
      ];
  let best: Point | null = null;
  let bestDistance = Infinity;
  for (const [c, d] of lines) {
    const hit = throughSegment(a, p, c, d);
    if (!hit) continue;
    const distance = Math.hypot(hit.x - a.x, hit.y - a.y);
    if (distance < bestDistance) {
      best = hit;
      bestDistance = distance;
    }
  }
  if (!best) return null;
  const local = { x: best.x - centre.x, y: best.y - centre.y };
  if (!insidePolygon(outlineOf(shape), local) && !onOutline(shape, local)) return null;
  const fraction = (value: number, size: number) => (size > 0 ? tidy(Math.min(1, Math.max(0, value / size + 0.5))) : 0.5);
  return [fraction(local.x, w), fraction(local.y, h)];
}

/** Where the line from `a` through `b`, beyond `b` too, crosses segment c–d. */
function throughSegment(a: Point, b: Point, c: Point, d: Point): Point | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const cross = r.x * s.y - r.y * s.x;
  if (Math.abs(cross) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / cross;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / cross;
  if (t < 0 || u < 0 || u > 1) return null;
  return { x: a.x + r.x * t, y: a.y + r.y * t };
}

/** Whether a local point sits on the outline itself (a diagonal's end). */
function onOutline(shape: SceneElement, local: Point): boolean {
  const outline = outlineOf(shape);
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) if (toSegment(local, outline[i], outline[j]) < 0.01) return true;
  return false;
}

/**
 * The side middle of `shape` nearest `point` within `within`, as an anchor and
 * where it is; the nearest, not the first, since on a small shape several are
 * in reach at once.
 */
export function nearestMiddle(shape: SceneElement, point: Point, within: number): { anchor: [number, number]; at: Point } | null {
  let best: { anchor: [number, number]; at: Point } | null = null;
  let bestDistance = within;
  for (const middle of SIDE_MIDDLES) {
    const at = spotOn(shape, middle);
    const distance = Math.hypot(at.x - point.x, at.y - point.y);
    if (distance <= bestDistance) {
      best = { anchor: middle, at };
      bestDistance = distance;
    }
  }
  return best;
}

/** A shape's stroke width, the file format's default when absent. */
function strokeOf(shape: SceneElement): number {
  return (shape as { strokeWidth?: number }).strokeWidth ?? 2;
}

/** Whether a point is strictly inside an element's drawn outline. */
export function isInside(shape: SceneElement, point: Point): boolean {
  return measureAgainst(shape, point).contains;
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

const NEVER_A_TARGET = new Set(['arrow', 'line', 'stroke', 'group']);

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

    const elbow = (element as { arrowType?: string }).arrowType === 'elbow';
    const shaped = elbow && fixedOf(element).length > 0 ? shapedRoute(element, scene) : null;
    const routed = shaped ? shaped.points : routeFor(element, scene);
    const { start, end } = bindingsOf(element);
    const attached = start !== undefined || end !== undefined;
    // An attached arrow's direction comes from the shapes it joins, so a
    // stored angle has nothing left to mean: keeping it would turn the arrow
    // away from the anchors just computed for it.
    const upright = attached && angleOfElement(element) !== 0 ? stripAngle(element) : element;
    // Fixed segments survive only where they were kept; a whole route has none.
    // Checked against the new route: a stub at an end shifts the indices.
    const marked =
      elbow && 'fixedSegments' in element
        ? withFixed({ ...upright, points: shaped ? shaped.points : routed } as SceneElement, shaped ? shaped.fixed : [])
        : upright;
    const settled = settledAround(marked, routed);
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
    points(before) !== points(after) ||
    JSON.stringify((before as { fixedSegments?: unknown }).fixedSegments) !==
      JSON.stringify((after as { fixedSegments?: unknown }).fixedSegments)
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
  const settled = {
    ...arrow,
    // The points are relative to x, y: shifting the box shifts them back.
    x: tidy(arrow.x + left),
    y: tidy(arrow.y + top),
    w: tidy(right - left),
    h: tidy(bottom - top),
    points: points.map((value, i) => tidy(value - (i % 2 === 0 ? left : top))),
  } as SceneElement;
  // A fixed segment's record follows its points, which just moved.
  if (!('fixedSegments' in arrow)) return settled;
  // Only an elbow keeps fixed segments (`docs/file-format.md`).
  return withFixed(settled, (arrow as { arrowType?: string }).arrowType === 'elbow' ? fixedOf(arrow) : []);
}
