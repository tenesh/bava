/**
 * Closed lines: a line whose last point is its first, kept a loop
 * (`closed: true`, `docs/file-format.md`), as Excalidraw's polygon.
 */
import { settledAround, unturned } from './binding';
import type { History } from './history';
import type { ElementId, LineElement, SceneElement } from './scene';

/**
 * Within this of the first point, Close line moves the last point onto it
 * rather than adding one (Excalidraw's `LINE_POLYGON_POINT_MERGE_DISTANCE`,
 * in the line's own units, so a constant rather than a token).
 */
export const CLOSE_MERGE_DISTANCE = 20;

/** Whether an element is a closed line. */
export function isClosed(element: SceneElement): boolean {
  return element.type === 'line' && (element as { closed?: boolean }).closed === true;
}

/**
 * Close a line into a loop, as one step: its last point moves onto the first
 * when it is within `CLOSE_MERGE_DISTANCE` of it and there are corners to
 * spare, and otherwise a point is added there
 * (Excalidraw's `toggleLinePolygonState`).
 */
export function closeLine(history: History, id: ElementId): void {
  history.mutate((scene) => {
    const i = scene.elements.findIndex((e) => e.id === id);
    const element = scene.elements[i];
    if (!element || element.type !== 'line' || isClosed(element)) return;
    // A turn written into the points first, so the line stays where it is drawn.
    const base = unturned(element);
    const points = [...(('points' in base ? base.points : []) as number[])];
    if (points.length < 6) return;
    const [fx, fy] = points;
    const far = Math.hypot(points[points.length - 2] - fx, points[points.length - 1] - fy) > CLOSE_MERGE_DISTANCE;
    if (far || points.length < 8) points.push(fx, fy);
    else points.splice(points.length - 2, 2, fx, fy);
    scene.elements[i] = { ...settledAround(base, points), closed: true } as LineElement;
  });
}

/** Open a closed line, as one step: its points stay; its fill goes with the loop. */
export function openLine(history: History, id: ElementId): void {
  history.mutate((scene) => {
    const element = scene.elements.find((e) => e.id === id) as (SceneElement & Record<string, unknown>) | undefined;
    if (!element || !isClosed(element)) return;
    delete element.closed;
    delete element.fill;
  });
}

/**
 * A closed line's points after `moved` of them moved: its first and last stay
 * on each other, the one that moved taking the other with it (Excalidraw's
 * `linearElementEditor.ts:1590-1603`).
 */
export function keepLoop(points: number[], moved: number[]): number[] {
  const last = points.length / 2 - 1;
  const out = [...points];
  if (moved.includes(0) && !moved.includes(last)) out.splice(last * 2, 2, out[0], out[1]);
  else if (moved.includes(last) && !moved.includes(0)) out.splice(0, 2, out[last * 2], out[last * 2 + 1]);
  return out;
}

/**
 * A closed line's points without `gone`: its first and last go together, and
 * the new first closes it again. Still a loop only with a corner to go round
 * (four points, the closing one included).
 */
export function removeFromLoop(points: number[], gone: Set<number>): { points: number[]; closed: boolean; kept: number[] } {
  const last = points.length / 2 - 1;
  const removed = new Set(gone);
  if (removed.has(0) || removed.has(last)) removed.add(0).add(last);
  const out = points.filter((_, i) => !removed.has(Math.floor(i / 2)));
  // `kept`: the old index each new point came from, the closing one last.
  const kept = Array.from({ length: last + 1 }, (_, i) => i).filter((i) => !removed.has(i));
  if (removed.has(0) && out.length >= 2) {
    out.push(out[0], out[1]);
    kept.push(kept[0]);
  }
  return { points: out, closed: out.length >= 8, kept };
}
