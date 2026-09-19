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
import { applyPatches, enablePatches, produce, produceWithPatches, type Patch } from 'immer';
import type { SceneData } from './scene';
import { reroute } from './binding';
import { applyMembership, membershipFor, movedIds } from './containment';

enablePatches();

type Step = {
  forward: Patch[];
  inverse: Patch[];
};

/** Whether two scenes hold different values, not merely different objects. */
function differs(before: SceneData, after: SceneData): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

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

    /**
     * Start over from data, with nothing to undo: a document was loaded.
     *
     * Attached arrows are aimed as part of the load, so a file written by
     * another hand, or by an older Bava, opens with its arrows on their
     * shapes rather than wherever the stored points last ran.
     */
    reset(data: SceneData): void {
      current = produce(data, (draft: SceneData) => reroute(draft));
      past.length = 0;
      future.length = 0;
    },

    /**
     * Apply a change and record how to reverse it.
     *
     * Attached arrows are re-aimed inside the same recipe, so every edit path
     * gets it without remembering to ask, and the re-routing is part of the
     * step it belongs to: one undo puts the shape and its arrows back
     * together (`.ai/rules/canvas.md`).
     */
    mutate(recipe: (draft: SceneData) => void): void {
      const [next, forward, inverse] = produceWithPatches(current, (draft) => {
        recipe(draft);
        // Both derived facts are settled inside the step that caused them:
        // which frame owns what, and where attached arrows now run. Only what
        // the change actually moved is reconsidered, so a frame dragged across
        // the canvas does not adopt whatever it passes over.
        applyMembership(draft, membershipFor(draft, movedIds(current, draft)));
        reroute(draft);
      });

      // A mutation that changed nothing must not consume a step, or undo
      // appears to do nothing, which reads as a broken undo. Patches are
      // recorded when a reference changes, so the values are compared too: a
      // drag that re-routing snaps straight back rewrites objects that hold
      // exactly what they held before.
      if (forward.length === 0 || !differs(current, next)) return;

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
