/**
 * Hit-testing by what an element draws, rather than by the box it is stored
 * in.
 *
 * A diagonal line's box is mostly empty space, and an axis-aligned one has no
 * height at all: testing the box means clicking a corner selects the line and
 * clicking the line misses it. The eraser has always tested the drawn path;
 * this is that logic, shared, so selection and the label editor test the same
 * thing (`.ai/rules/canvas.md`).
 */
import { routePoints } from './arrows';
import { smoothPoints } from './curves';
import { paintFor } from './paint';
import { angleOfElement, centreOf, rotatePoint } from './rotate';
import type { ReadVariable } from './palette';
import type { Box } from './selection';
import type { SceneElement } from './scene';

export type Point = { x: number; y: number };

/** Round edges only change tension, which needs no theme to read. */
const NO_THEME: ReadVariable = () => '';

/**
 * What an element draws as a path, in scene coordinates: a line's, arrow's or
 * stroke's route, a frame's outline. Empty for anything drawn as an area,
 * which the box already describes.
 */
export function drawnPathOf(element: SceneElement): Point[] {
  const at = (x: number, y: number): Point => {
    const angle = angleOfElement(element);
    const point = { x: element.x + x, y: element.y + y };
    return angle === 0 ? point : rotatePoint(point, centreOf(element), angle);
  };

  if (element.type === 'frame') {
    const { w, h } = element;
    return [at(0, 0), at(w, 0), at(w, h), at(0, h), at(0, 0)];
  }
  if (element.type === 'line' || element.type === 'arrow' || element.type === 'stroke') {
    const points = ('points' in element ? element.points : []) as number[];
    const routed = element.type === 'arrow' ? routePoints(points, (element as { arrowType?: string }).arrowType) : points;
    const drawn = smoothPoints(routed, paintFor(element, NO_THEME).tension);
    const path: Point[] = [];
    for (let i = 0; i + 1 < drawn.length; i += 2) path.push(at(drawn[i], drawn[i + 1]));
    return path;
  }
  return [];
}

/** The distance from a point to a segment. */
function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Whether a point is within `tolerance` of what an element draws. False for
 * an element with no path: those are hit by their box, which holds them.
 */
export function nearElement(element: SceneElement, point: Point, tolerance: number): boolean {
  const path = drawnPathOf(element);
  if (path.length === 0) return false;
  if (path.length === 1) return Math.hypot(point.x - path[0].x, point.y - path[0].y) <= tolerance;
  for (let i = 0; i + 1 < path.length; i += 1) {
    if (toSegment(point, path[i], path[i + 1]) <= tolerance) return true;
  }
  return false;
}

/** The box around a path, for an element whose drawing leaves its stored box. */
export function pathBounds(path: Point[]): Box {
  if (path.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = path.map((p) => p.x);
  const ys = path.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Whether an element is drawn as a path rather than an area. */
export function isLinear(type: string): boolean {
  return type === 'line' || type === 'arrow' || type === 'stroke';
}
