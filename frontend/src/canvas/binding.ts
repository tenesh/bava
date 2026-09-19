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
import { angleOfElement, centreOf, containsPoint, rotatePoint } from './rotate';
import { isOutlineShape, drawOutline, type PathSink } from './shapes';
import type { ElementId, SceneData, SceneElement } from './scene';
import { drawnPathOf, pathBounds } from './hit';
import { tidy } from './resize';

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
 * The point on `shape`'s outline, on the line from its centre towards
 * `towards`, pushed `BINDING_GAP` further out.
 *
 * The outline is the one that is drawn: an ellipse's curve, a polygon's edges
 * through `shapes.ts`, a box otherwise, each turned by the shape's angle. A
 * point at the centre has no direction; the anchor is then the centre itself,
 * which the caller replaces as soon as the other end moves.
 */
export function anchorOn(shape: SceneElement, towards: Point): Point {
  const centre = centreOf(shape);
  const dx = towards.x - centre.x;
  const dy = towards.y - centre.y;
  if (dx === 0 && dy === 0) return centre;

  const angle = angleOfElement(shape);
  // Work in the shape's own frame, where its outline is upright, then turn the
  // answer back: one piece of geometry rather than one per rotation.
  const local = rotatePoint(towards, centre, -angle);
  const hit = outlineHit(shape, { x: local.x - centre.x, y: local.y - centre.y });
  const length = Math.hypot(hit.x, hit.y) || 1;
  const out = { x: centre.x + hit.x + (hit.x / length) * BINDING_GAP, y: centre.y + hit.y + (hit.y / length) * BINDING_GAP };
  return rotatePoint(out, centre, angle);
}

/** Where a ray from the centre leaves the shape, in the shape's own frame. */
function outlineHit(shape: SceneElement, direction: Point): Point {
  const halfW = shape.w / 2;
  const halfH = shape.h / 2;
  if (halfW <= 0 || halfH <= 0) return { x: 0, y: 0 };

  if (shape.type === 'ellipse') {
    // The ray meets the ellipse where (x/a)² + (y/b)² = 1.
    const scale = 1 / Math.hypot(direction.x / halfW, direction.y / halfH);
    return { x: direction.x * scale, y: direction.y * scale };
  }
  if (isOutlineShape(shape.type)) {
    const hit = polygonHit(shape, direction);
    if (hit) return hit;
  }
  // A box: the ray leaves through whichever side it reaches first.
  const scale = Math.min(halfW / Math.abs(direction.x || Number.EPSILON), halfH / Math.abs(direction.y || Number.EPSILON));
  return { x: direction.x * scale, y: direction.y * scale };
}

/** Where a ray leaves a drawn polygon, using the outline the canvas draws. */
function polygonHit(shape: SceneElement, direction: Point): Point | null {
  const points = outlinePoints(shape);
  const centre = { x: shape.w / 2, y: shape.h / 2 };
  const far = { x: centre.x + direction.x * 1e4, y: centre.y + direction.y * 1e4 };
  let best: Point | null = null;
  let nearest = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const meeting = segmentsCross(centre, far, points[i], points[(i + 1) % points.length]);
    if (!meeting) continue;
    const distance = Math.hypot(meeting.x - centre.x, meeting.y - centre.y);
    if (distance < nearest) {
      nearest = distance;
      best = { x: meeting.x - centre.x, y: meeting.y - centre.y };
    }
  }
  return best;
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

/** Where two segments meet, or null. */
function segmentsCross(a: Point, b: Point, c: Point, d: Point): Point | null {
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (denominator === 0) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
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
  if (!startShape && !endShape) return points;

  // Each end aims at where the other end currently is.
  const world = (index: number): Point => ({ x: arrow.x + points[index], y: arrow.y + points[index + 1] });
  const last = points.length - 2;
  const startTarget = endShape ? centreOf(endShape) : world(last);
  const endTarget = startShape ? centreOf(startShape) : world(0);

  // An end aimed at its own shape's centre has no direction to leave by, and
  // anchoring it there would collapse the arrow to a point. It keeps the
  // point it was drawn with until the other end moves somewhere else.
  const aimless = (shape: SceneElement, towards: Point) => {
    const centre = centreOf(shape);
    return towards.x === centre.x && towards.y === centre.y;
  };

  if (startShape && !aimless(startShape, startTarget)) {
    const anchor = anchorOn(startShape, startTarget);
    points[0] = anchor.x - arrow.x;
    points[1] = anchor.y - arrow.y;
  }
  if (endShape && !aimless(endShape, endTarget)) {
    const anchor = anchorOn(endShape, endTarget);
    points[last] = anchor.x - arrow.x;
    points[last + 1] = anchor.y - arrow.y;
  }
  return points;
}

/**
 * The element an arrow end dropped at `point` should attach to, if any.
 *
 * A frame is not a target: an arrow drawn inside one would otherwise attach to
 * the container rather than to the shape the user aimed at. Neither is a
 * group, which draws nothing, nor another linear element, which has no
 * outline to anchor on.
 */
export function targetAt(scene: SceneData, point: Point, exclude: ElementId): SceneElement | undefined {
  const hits = scene.elements.filter(
    (element) =>
      element.id !== exclude &&
      !NEVER_A_TARGET.has(element.type) &&
      element.locked !== true &&
      containsPoint(element, point),
  );
  return hits[hits.length - 1];
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
    const settled = withPoints(upright, routed);
    if (!changed(element, settled)) continue;
    scene.elements[i] = settled;
  }
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
function withPoints(arrow: SceneElement, points: number[]): SceneElement {
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
