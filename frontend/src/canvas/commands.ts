/**
 * Canvas edits that arrive as menu commands: delete, clipboard, grouping and
 * paint order, plus undo and redo.
 *
 * Each edit runs over a working scene and lands in history as one mutation,
 * so every command is exactly one undo step. The caller publishes the new
 * snapshot afterwards.
 */
import { alignMoves, distributeMoves, type Alignment, type Move } from './align';
import { duplicate, flip, group, paste, steppedOrder, topLevel, ungroup, withContents } from './edit';
import { tidy } from './resize';
import { copyStyle, pasteStyle, type CopiedStyle } from './style';
import { createScene, isLocked, type ElementId, type Scene, type SceneElement } from './scene';
import { rotatedBounds } from './rotate';
import { releaseFrames } from './containment';
import { remapReferences } from './references';
import type { History } from './history';
import type { Selection } from './selection';

/**
 * Elements whose ids do not collide with `taken`, with every reference to a
 * renamed element rewritten.
 *
 * An id has to be unique within the file (`docs/file-format.md`), and
 * bindings and frame membership are ids: a collision would attach an arrow to
 * whatever already held that id, silently.
 */
function withFreshIds(elements: SceneElement[], taken: Set<ElementId>): SceneElement[] {
  const renamed = new Map<ElementId, ElementId>();
  for (const element of elements) {
    if (!taken.has(element.id)) continue;
    let candidate = `${element.id}-${Math.random().toString(36).slice(2, 8)}`;
    while (taken.has(candidate)) candidate = `${element.id}-${Math.random().toString(36).slice(2, 8)}`;
    taken.add(candidate);
    renamed.set(element.id, candidate);
  }
  if (renamed.size === 0) return elements;

  return remapReferences(elements, renamed).map((element) => ({
    ...element,
    id: renamed.get(element.id) ?? element.id,
  })) as SceneElement[];
}

export function createCanvasCommands(options: {
  history: History;
  selection: Selection;
  /** Called on each element a style is pasted onto, in the same step: a code block refitted (06.17). */
  afterPasteStyle?: (element: SceneElement) => void;
}) {
  const { history, selection } = options;
  // In-app only for now. The system clipboard carries text; a scene fragment
  // there is Milestone 15's export format, not an ad hoc JSON blob.
  let clipboard: SceneElement[] = [];
  /** The ids that were selected when copying: their copies are selected on paste. */
  let clipboardRoots = new Set<ElementId>();
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
      releaseFrames(draft, ids);
    });
    selection.clear();
  }

  function copy(): boolean {
    const elements = selected();
    if (elements.length === 0) return false;
    // A group's children and a frame's contents are copied with it, in paint
    // order, and paste selects the copies of what was selected.
    clipboard = withContents(createScene(history.current), elements).sort((a, b) => a.z - b.z);
    clipboardRoots = new Set(elements.map((e) => e.id));
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
    // Align and distribute line up what is on screen, so a rotated element's
    // unit is the box around it as drawn.
    // A member selected along with its frame goes with the frame, as a group's
    // child goes with the group, rather than being a unit of its own.
    const chosen = selected();
    // Everything inside a selected frame, nested frames included, but not the
    // selected frame itself.
    const inChosenFrame = new Set(
      chosen
        .filter((e) => e.type === 'frame')
        .flatMap((frame) => withContents(scene, [frame]).filter((e) => e.id !== frame.id))
        .map((e) => e.id),
    );
    const units = topLevel(scene, chosen)
      .filter((e) => !inChosenFrame.has(e.id))
      .map((e) => ({ id: e.id, box: rotatedBounds(e) }));
    const moves = plan(units);
    if (moves.size === 0) return;
    edit((scene) => {
      // A frame's contents move with it. Each element moves once, even when it
      // is both selected and inside a selected frame.
      const moved = new Set<ElementId>();
      for (const [id, move] of moves) {
        const element = scene.get(id);
        if (!element) continue;
        for (const member of withContents(scene, [element])) {
          if (moved.has(member.id)) continue;
          moved.add(member.id);
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

    /**
     * Put a diagram converted from code on the canvas.
     *
     * One step, so one undo removes the whole thing, and selected on arrival
     * so it can be dragged somewhere else straight away. The elements are
     * ordinary from here on: nothing records that they were generated.
     */
    insertDiagram(elements: SceneElement[]): void {
      if (elements.length === 0) return;
      const arriving = withFreshIds(elements, new Set(history.current.elements.map((element) => element.id)));
      const top = history.current.elements.reduce((max, element) => Math.max(max, element.z), 0);
      history.mutate((draft) => {
        // Above whatever is already there, keeping the order they arrived in.
        draft.elements.push(...arriving.map((element, i) => ({ ...element, z: top + 1 + i })));
      });
      select(arriving.map((element) => element.id));
    },

    /** Resolves true when something was pasted. */
    paste(): boolean {
      if (clipboard.length === 0) return false;
      const pasted = edit((scene) => paste(scene, clipboard));
      // `paste` returns one copy per clipboard element, in the same order.
      select(pasted.filter((_, i) => clipboardRoots.has(clipboard[i].id)).map((e) => e.id));
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
      pasteStyle(history, selection.ids, copiedStyle, options.afterPasteStyle);
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

    // A group's children and a frame's contents go with it, in the order
    // they already had: raised lowest first, lowered highest first.
    bringToFront(): void {
      if (selection.ids.length === 0) return;
      edit((scene) => {
        const all = withContents(scene, selected()).sort((a, b) => a.z - b.z);
        all.forEach((element) => scene.bringToFront(element.id));
      });
    },

    sendToBack(): void {
      if (selection.ids.length === 0) return;
      edit((scene) => {
        const all = withContents(scene, selected()).sort((a, b) => b.z - a.z);
        all.forEach((element) => scene.sendToBack(element.id));
      });
    },
  };
}

export type CanvasCommands = ReturnType<typeof createCanvasCommands>;
