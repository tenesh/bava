/**
 * The eraser: which elements a trail touches, and what erasing them removes.
 *
 * Pure functions over the scene. Hit-testing is against each element's box;
 * a group is never hit by its own box, only through its children, since the
 * space between them is empty canvas. Erasing an element takes its outermost
 * group, so a group is never left pointing at a missing child.
 */
import type { ElementId, SceneData, SceneElement } from './scene';

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
 * What an element draws as lines, in scene coordinates: a frame's outline, a
 * line's, arrow's or stroke's path. Null for elements drawn as an area.
 */
function drawnPath(e: SceneElement): Point[] | null {
  if (e.type === 'frame') {
    return [
      { x: e.x, y: e.y },
      { x: e.x + e.w, y: e.y },
      { x: e.x + e.w, y: e.y + e.h },
      { x: e.x, y: e.y + e.h },
      { x: e.x, y: e.y },
    ];
  }
  if ('points' in e && Array.isArray(e.points)) {
    const path: Point[] = [];
    for (let i = 0; i + 1 < e.points.length; i += 2) path.push({ x: e.x + e.points[i], y: e.y + e.points[i + 1] });
    return path;
  }
  return null;
}

/** Whether the trail segment touches what the element draws. */
function touches(e: SceneElement, from: Point, to: Point, tolerance: number): boolean {
  const path = drawnPath(e);
  if (!path) return crosses(e, from, to);
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
  const hit = scene.elements.filter((e) => e.type !== 'group' && touches(e, from, to, tolerance));
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
