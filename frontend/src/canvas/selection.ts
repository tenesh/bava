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

  /** Select the next unlocked element in paint order, `by` 1 or -1. */
  function step(data: SceneData, by: 1 | -1): void {
    const count = data.elements.length;
    const from = index(data);
    // With nothing selected, forward starts at the first and back at the last.
    const start = from < 0 ? (by === 1 ? -1 : count) : from;
    for (let i = 1; i <= count; i += 1) {
      const element = data.elements[(((start + by * i) % count) + count) % count];
      if (!isLocked(element)) {
        ids = [element.id];
        return;
      }
    }
    ids = [];
  }

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

    /**
     * Tab order is paint order, which is the order a reader sees them in. A
     * locked element is stepped over: nothing may select it.
     */
    selectNext(data: SceneData): void {
      step(data, 1);
    },

    selectPrevious(data: SceneData): void {
      step(data, -1);
    },
  };
}

export type Selection = ReturnType<typeof createSelection>;
