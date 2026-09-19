/**
 * The eraser: which elements a trail touches, and what erasing them removes.
 *
 * Pure functions over the scene. Hit-testing is against each element's box;
 * a group is never hit by its own box, only through its children, since the
 * space between them is empty canvas. Erasing an element takes its outermost
 * group, so a group is never left pointing at a missing child.
 */
import { isLocked, type ElementId, type SceneData, type SceneElement } from './scene';
import { angleOfElement, toLocal } from './rotate';
import { drawnPathOf } from './hit';

type Point = { x: number; y: number };

function contains(e: SceneElement, p: Point): boolean {
  return p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h;
}

/** Whether a segment meets a box: an endpoint inside, or crossing an edge. */
function crosses(e: SceneElement, a: Point, b: Point): boolean {
  if (contains(e, a) || contains(e, b)) return true;
  const corners: Point[] = [
    { x: e.x, y: e.y },
    { x: e.x + e.w, y: e.y },
    { x: e.x + e.w, y: e.y + e.h },
    { x: e.x, y: e.y + e.h },
  ];
  return corners.some((c, i) => segmentsMeet(a, b, c, corners[(i + 1) % 4]));
}

function segmentsMeet(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function pointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function segmentToSegment(a: Point, b: Point, c: Point, d: Point): number {
  if (segmentsMeet(a, b, c, d)) return 0;
  return Math.min(pointToSegment(a, c, d), pointToSegment(b, c, d), pointToSegment(c, a, b), pointToSegment(d, a, b));
}


/**
 * Whether the trail segment touches what the element draws.
 *
 * The path comes from `hit.ts`, the same one selection and the label editor
 * test, so an elbow's dog-leg and an arc's bow are erased where the user sees
 * them. An element drawn as an area has no path, and is tested by its box,
 * with the trail turned into the element's own frame when it is rotated.
 */
function touches(e: SceneElement, trailFrom: Point, trailTo: Point, tolerance: number): boolean {
  const path = drawnPathOf(e);
  if (path.length === 0) {
    // An element's stored geometry is its upright box, so a rotated one is
    // tested by turning the trail into its frame rather than turning the shape.
    const turned = angleOfElement(e) !== 0;
    const from = turned ? toLocal(trailFrom, e) : trailFrom;
    const to = turned ? toLocal(trailTo, e) : trailTo;
    return crosses(e, from, to);
  }
  const from = trailFrom;
  const to = trailTo;
  if (path.length === 1) return segmentToSegment(from, to, path[0], path[0]) <= tolerance;
  for (let i = 0; i + 1 < path.length; i += 1) {
    if (segmentToSegment(from, to, path[i], path[i + 1]) <= tolerance) return true;
  }
  return false;
}

/**
 * Elements the trail from `from` to `to` touches: an area when it crosses the
 * box, a frame or a line, arrow or stroke only within `tolerance` of what it
 * draws. A click (the same point twice) touches only the topmost.
 */
export function erasableAlong(scene: SceneData, from: Point, to: Point, tolerance = 3): ElementId[] {
  // A locked element is skipped: the eraser does not edit what cannot be moved.
  const hit = scene.elements.filter((e) => e.type !== 'group' && !isLocked(e) && touches(e, from, to, tolerance));
  if (from.x === to.x && from.y === to.y) {
    const top = [...hit].sort((a, b) => b.z - a.z)[0];
    return top ? [top.id] : [];
  }
  return hit.map((e) => e.id);
}

/** The topmost element under a point, if any: what a right-click acts on. */
export function topmostAt(scene: SceneData, point: Point): ElementId | undefined {
  return erasableAlong(scene, point, point)[0];
}

/** The marked elements plus every group (outermost included) containing one, and those groups' members. */
export function eraseSet(scene: SceneData, marked: Iterable<ElementId>): Set<ElementId> {
  const groups = scene.elements.filter((e): e is Extract<SceneElement, { type: 'group' }> => e.type === 'group');
  const parentOf = new Map<ElementId, ElementId>();
  for (const group of groups) group.children.forEach((child) => parentOf.set(child, group.id));

  const result = new Set<ElementId>();
  const addWithMembers = (id: ElementId) => {
    if (result.has(id)) return;
    result.add(id);
    groups.find((g) => g.id === id)?.children.forEach(addWithMembers);
  };
  for (const id of marked) {
    let top = id;
    while (parentOf.has(top)) top = parentOf.get(top)!;
    addWithMembers(top);
  }
  return result;
}
