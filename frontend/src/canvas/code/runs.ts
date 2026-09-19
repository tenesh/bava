/**
 * The tokenised code every drawing path reads.
 *
 * Highlighting is asynchronous, because a language loads the first time it is
 * used, and the stage and the exporter are both synchronous. One store holds
 * the result: the stage is handed it as it arrives, and an export reads the
 * same map rather than tokenising again and possibly differently.
 *
 * Passes are tagged, and a stale one is dropped: changing a language and then
 * typing starts two, and the older must not land on top of the newer. This is
 * the rule `ipc/render.svelte.ts` follows for renders, for the same reason.
 */
import { toRuns, type Run } from './highlight';
import { loadParser } from './languages';
import type { ElementId, SceneData } from '../scene';

export type CodeRunsOptions = {
  /** Called when a pass finishes with runs to draw. */
  onRuns?: (id: ElementId, runs: Run[][]) => void;
};

export function createCodeRuns(options: CodeRunsOptions = {}) {
  const byElement = new Map<ElementId, Run[][]>();
  let latest = 0;

  return {
    /** The runs for a block, or nothing for one not yet tokenised. */
    forElement(id: ElementId): Run[][] {
      return byElement.get(id) ?? [];
    },

    /** Every block's runs, for an export. */
    all(): Record<string, Run[][]> {
      return Object.fromEntries(byElement);
    },

    /**
     * Colour every code block in `scene`. Blocks are done together rather than
     * one after another, so two languages do not load in series.
     */
    async update(scene: SceneData): Promise<void> {
      const pass = ++latest;
      const blocks = scene.elements.filter((element) => element.type === 'code');

      // A block that has gone is forgotten, so the map does not grow for the
      // life of the session.
      const present = new Set(blocks.map((block) => block.id));
      for (const id of [...byElement.keys()]) if (!present.has(id)) byElement.delete(id);

      await Promise.all(
        blocks.map(async (element) => {
          const block = element as typeof element & { code: string; language?: string };
          const parser = await loadParser(block.language);
          // Anything but the newest pass is discarded, however good it is.
          if (pass !== latest) return;
          const runs = toRuns(block.code, parser);
          byElement.set(block.id, runs);
          options.onRuns?.(block.id, runs);
        }),
      );
    },
  };
}

export type CodeRuns = ReturnType<typeof createCodeRuns>;
