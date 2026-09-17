/**
 * Undo and redo over scene mutations.
 *
 * One history. Every mutation (a drag, a tool, an AI edit later) goes
 * through `mutate`, so Ctrl+Z means one thing. Two histories is where undo
 * becomes unpredictable, and the first thing a user does after a change they
 * dislike is press it.
 *
 * Patch-based rather than snapshot-based: a snapshot per step grows with the
 * scene, and hand-rolled inverse operations are where undo bugs live. Immer
 * produces both directions from the same mutation.
 */
import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import type { SceneData } from './scene';

enablePatches();

type Step = {
  forward: Patch[];
  inverse: Patch[];
};

export function createHistory(initial: SceneData) {
  let current: SceneData = initial;
  const past: Step[] = [];
  const future: Step[] = [];

  return {
    get current(): SceneData {
      return current;
    },

    get canUndo(): boolean {
      return past.length > 0;
    },

    get canRedo(): boolean {
      return future.length > 0;
    },

    /** Start over from data, with nothing to undo: a document was loaded. */
    reset(data: SceneData): void {
      current = data;
      past.length = 0;
      future.length = 0;
    },

    /** Apply a change and record how to reverse it. */
    mutate(recipe: (draft: SceneData) => void): void {
      const [next, forward, inverse] = produceWithPatches(current, recipe);

      // A mutation that changed nothing must not consume a step, or undo
      // appears to do nothing, which reads as a broken undo.
      if (forward.length === 0) return;

      current = next;
      past.push({ forward, inverse });
      future.length = 0;
    },

    undo(): void {
      const step = past.pop();
      if (!step) return;
      current = applyPatches(current, step.inverse);
      future.push(step);
    },

    redo(): void {
      const step = future.pop();
      if (!step) return;
      current = applyPatches(current, step.forward);
      past.push(step);
    },
  };
}

export type History = ReturnType<typeof createHistory>;
