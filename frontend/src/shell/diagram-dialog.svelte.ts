/**
 * The Diagram from Code dialog's layout state: the engine and direction its
 * preview is rendered with, which is what Insert then uses.
 *
 * The engine opens at the configured default and, once a diagram is inserted
 * with another, that one becomes the default. The direction is per diagram and
 * not kept. TALA ignores direction, so none is sent for it.
 */
import type { Direction, LayoutEngine } from '../settings/layout-engine';

export type DiagramDialogOptions = {
  /** Queue a render of the dialog's source through its render client. */
  request: (source: string, layout: { engine: LayoutEngine; direction: string }) => void;
  defaultEngine: () => LayoutEngine;
  /** Save an engine as the new default. */
  saveDefault: (engine: LayoutEngine) => Promise<void>;
};

export function createDiagramDialog(options: DiagramDialogOptions) {
  let engine = $state.raw<LayoutEngine>('tala');
  let direction = $state.raw<Direction>('down');
  let source = '';

  function render(): void {
    options.request(source, { engine, direction: engine === 'tala' ? '' : direction });
  }

  return {
    get engine(): LayoutEngine {
      return engine;
    },
    get direction(): Direction {
      return direction;
    },

    /** Start over from `starter`, at the default engine, facing down. */
    open(starter: string): void {
      engine = options.defaultEngine();
      direction = 'down';
      source = starter;
      render();
    },

    setEngine(next: LayoutEngine): void {
      engine = next;
      render();
    },

    setDirection(next: Direction): void {
      direction = next;
      render();
    },

    setSource(next: string): void {
      source = next;
      render();
    },

    /**
     * A diagram was inserted: its engine becomes the default. Resolves true
     * when the default changed, so the caller can re-render what depends on it.
     */
    async inserted(): Promise<boolean> {
      if (engine === options.defaultEngine()) return false;
      await options.saveDefault(engine);
      return true;
    },
  };
}
