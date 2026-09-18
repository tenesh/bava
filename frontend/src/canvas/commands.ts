/**
 * Canvas edits that arrive as menu commands: delete, clipboard, grouping and
 * paint order, plus undo and redo.
 *
 * Each edit runs over a working scene and lands in history as one mutation,
 * so every command is exactly one undo step. The caller publishes the new
 * snapshot afterwards.
 */
import { alignMoves, distributeMoves, type Alignment, type Move } from './align';
import { duplicate, flip, group, paste, steppedOrder, topLevel, ungroup, withDescendants } from './edit';
import { tidy } from './resize';
import { copyStyle, pasteStyle, type CopiedStyle } from './style';
import { createScene, isLocked, type Scene, type SceneElement } from './scene';
import type { History } from './history';
import type { Selection } from './selection';

export function createCanvasCommands(options: { history: History; selection: Selection }) {
  const { history, selection } = options;
  // In-app only for now. The system clipboard carries text; a scene fragment
  // there is Milestone 15's export format, not an ad hoc JSON blob.
  let clipboard: SceneElement[] = [];
  // Copy Styles keeps its own clipboard: copying a style must not replace
  // copied elements.
  let copiedStyle: CopiedStyle | null = null;

  function edit<T>(change: (scene: Scene) => T): T {
    const working = createScene({ elements: [...history.current.elements] });
    const result = change(working);
    const next = working.data().elements;
    history.mutate((draft) => {
      draft.elements = next as never;
    });
    return result;
  }

  function selected(): SceneElement[] {
    return history.current.elements.filter((e) => selection.has(e.id));
  }

  function deleteSelection(): void {
    const ids = new Set(selection.ids);
    if (ids.size === 0) return;
    history.mutate((draft) => {
      draft.elements = draft.elements.filter((e) => !ids.has(e.id));
    });
    selection.clear();
  }

  function copy(): boolean {
    const elements = selected();
    if (elements.length === 0) return false;
    clipboard = elements;
    return true;
  }

  /**
   * One step up or down the paint order. Paint order is renumbered 1..n where
   * it changed: stepping by swapping z values did nothing when neighbours
   * shared one.
   */
  function reorder(direction: 1 | -1): void {
    if (selection.ids.length === 0) return;
    const scene = createScene({ elements: [...history.current.elements] });
    const order = steppedOrder(scene, selection.ids, direction);
    const z = new Map(order.map((e, i) => [e.id, i + 1]));
    const before = scene.ordered().map((e) => e.id).join(' ');
    if (order.map((e) => e.id).join(' ') === before) return;
    history.mutate((draft) => {
      for (const element of draft.elements) {
        const next = z.get(element.id);
        if (next !== undefined && next !== element.z) element.z = next;
      }
      draft.elements.sort((a, b) => a.z - b.z);
    });
  }

  /**
   * Move each selected unit by the offset `plan` gives it. A group's children
   * move with it: they keep their own coordinates.
   */
  function moveUnits(plan: (units: { id: string; box: { x: number; y: number; w: number; h: number } }[]) => Map<string, Move>): void {
    const scene = createScene({ elements: [...history.current.elements] });
    const units = topLevel(scene, selected()).map((e) => ({ id: e.id, box: { x: e.x, y: e.y, w: e.w, h: e.h } }));
    const moves = plan(units);
    if (moves.size === 0) return;
    edit((scene) => {
      for (const [id, move] of moves) {
        const element = scene.get(id);
        if (!element) continue;
        for (const member of withDescendants(scene, [element])) {
          scene.update(member.id, { x: tidy(member.x + move.dx), y: tidy(member.y + move.dy) });
        }
      }
    });
  }

  function select(ids: string[]): void {
    selection.clear();
    ids.forEach((id, i) => selection.click(id, { additive: i > 0 }));
  }

  return {
    get hasSelection(): boolean {
      return selection.ids.length > 0;
    },

    get canPaste(): boolean {
      return clipboard.length > 0;
    },

    get canPasteStyles(): boolean {
      return copiedStyle !== null;
    },

    undo: () => history.undo(),
    redo: () => history.redo(),
    selectAll: () => selection.selectAll(history.current),
    deleteSelection,
    copy,

    cut(): boolean {
      if (!copy()) return false;
      deleteSelection();
      return true;
    },

    /** Resolves true when something was pasted. */
    paste(): boolean {
      if (clipboard.length === 0) return false;
      const pasted = edit((scene) => paste(scene, clipboard));
      select(pasted.map((e) => e.id));
      return true;
    },

    group(): void {
      const ids = selection.ids;
      if (ids.length < 2) return;
      const created = edit((scene) => group(scene, ids));
      if (created) select([created.id]);
    },

    ungroup(): void {
      const groups = selected().filter((e) => e.type === 'group');
      if (groups.length === 0) return;
      edit((scene) => groups.forEach((g) => ungroup(scene, g.id)));
      selection.clear();
    },

    bringForward(): void {
      reorder(1);
    },

    sendBackward(): void {
      reorder(-1);
    },

    /** Whether anything in the scene is locked, for Unlock All. */
    get hasLocked(): boolean {
      return history.current.elements.some(isLocked);
    },

    /** Lock the selection: it is no longer selectable, so the selection clears. */
    lock(): void {
      const ids = new Set(selection.ids);
      if (ids.size === 0) return;
      history.mutate((draft) => {
        for (const element of draft.elements) {
          if (ids.has(element.id)) (element as SceneElement & { locked?: boolean }).locked = true;
        }
      });
      selection.clear();
    },

    /** Free every locked element in the scene, in one step. */
    unlockAll(): void {
      if (!history.current.elements.some(isLocked)) return;
      history.mutate((draft) => {
        for (const element of draft.elements) {
          delete (element as SceneElement & { locked?: boolean }).locked;
        }
      });
    },

    copyStyles(): void {
      const first = selected()[0];
      if (first) copiedStyle = copyStyle(first);
    },

    pasteStyles(): void {
      if (!copiedStyle || selection.ids.length === 0) return;
      pasteStyle(history, selection.ids, copiedStyle);
    },

    align(alignment: Alignment): void {
      moveUnits((units) => alignMoves(units, alignment));
    },

    distribute(axis: 'horizontal' | 'vertical'): void {
      moveUnits((units) => distributeMoves(units, axis));
    },

    duplicate(): void {
      const elements = selected();
      if (elements.length === 0) return;
      const copies = edit((scene) => duplicate(scene, elements));
      select(copies.map((e) => e.id));
    },

    flipHorizontal(): void {
      const elements = selected();
      if (elements.length === 0) return;
      edit((scene) => flip(scene, elements, 'horizontal'));
    },

    flipVertical(): void {
      const elements = selected();
      if (elements.length === 0) return;
      edit((scene) => flip(scene, elements, 'vertical'));
    },

    bringToFront(): void {
      const ids = selection.ids;
      if (ids.length === 0) return;
      edit((scene) => ids.forEach((id) => scene.bringToFront(id)));
    },

    sendToBack(): void {
      // Reversed so the selection keeps its own relative order at the back.
      const ids = [...selection.ids].reverse();
      if (ids.length === 0) return;
      edit((scene) => ids.forEach((id) => scene.sendToBack(id)));
    },
  };
}

export type CanvasCommands = ReturnType<typeof createCanvasCommands>;
