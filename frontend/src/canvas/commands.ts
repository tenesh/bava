/**
 * Canvas edits that arrive as menu commands: delete, clipboard, grouping and
 * paint order, plus undo and redo.
 *
 * Each edit runs over a working scene and lands in history as one mutation,
 * so every command is exactly one undo step. The caller publishes the new
 * snapshot afterwards.
 */
import { group, paste, ungroup } from './edit';
import { createScene, type Scene, type SceneElement } from './scene';
import type { History } from './history';
import type { Selection } from './selection';

export function createCanvasCommands(options: { history: History; selection: Selection }) {
  const { history, selection } = options;
  // In-app only for now. The system clipboard carries text; a scene fragment
  // there is Milestone 15's export format, not an ad hoc JSON blob.
  let clipboard: SceneElement[] = [];

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

  function select(ids: string[]): void {
    selection.clear();
    ids.forEach((id, i) => selection.click(id, { additive: i > 0 }));
  }

  return {
    get hasSelection(): boolean {
      return selection.ids.length > 0;
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
