/**
 * What is selected.
 *
 * Pure logic over scene data (no Konva, no DOM), so the behaviour that is
 * easy to get subtly wrong (additive clicks, marquee edges, keyboard
 * traversal) is testable directly.
 *
 * Keyboard traversal exists because Milestone 1 shipped an interactive
 * affordance with no keyboard path. This covers scene elements; reaching a
 * node *inside* a diagram waits for Milestone 6, when diagram elements exist.
 */
import type { ElementId, SceneData } from './scene';
import { isLocked } from './scene';
import { rotatedBounds } from './rotate';

export type Box = { x: number; y: number; w: number; h: number };

/** Touching edges count as intersecting: a marquee that grazes a shape selects it. */
export function intersects(a: Box, b: Box): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

export function createSelection() {
  let ids: ElementId[] = [];

  function index(data: SceneData): number {
    if (ids.length !== 1) return -1;
    return data.elements.findIndex((e) => e.id === ids[0]);
  }

  return {
    get ids(): ElementId[] {
      return [...ids];
    },

    has(id: ElementId): boolean {
      return ids.includes(id);
    },

    click(id: ElementId, options: { additive?: boolean } = {}): void {
      if (!options.additive) {
        ids = [id];
        return;
      }
      ids = ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
    },

    // A locked element is not selectable, by marquee or by Select All. A
    // rotated one is caught where it is drawn, not where its stored box is.
    marquee(box: Box, data: SceneData): void {
      ids = data.elements.filter((e) => !isLocked(e) && intersects(box, rotatedBounds(e))).map((e) => e.id);
    },

    selectAll(data: SceneData): void {
      ids = data.elements.filter((e) => !isLocked(e)).map((e) => e.id);
    },

    clear(): void {
      ids = [];
    },

    /** Keep only ids that still exist, for after an undo removes elements. */
    retain(existing: ElementId[]): void {
      const present = new Set(existing);
      if (ids.some((id) => !present.has(id))) ids = ids.filter((id) => present.has(id));
    },

    /** Tab order is paint order, which is the order a reader sees them in. */
    selectNext(data: SceneData): void {
      if (data.elements.length === 0) return;
      const next = (index(data) + 1) % data.elements.length;
      ids = [data.elements[next].id];
    },

    selectPrevious(data: SceneData): void {
      if (data.elements.length === 0) return;
      const current = index(data);
      const previous = current <= 0 ? data.elements.length - 1 : current - 1;
      ids = [data.elements[previous].id];
    },
  };
}

export type Selection = ReturnType<typeof createSelection>;
