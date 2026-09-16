import { describe, expect, it } from 'vitest';
import { createViewState, VIEW_STATE_KEY } from './view.svelte';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

const throwing = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('SecurityError');
  },
};

describe('view mode', () => {
  it('starts in both', () => {
    const view = createViewState({ storage: memoryStorage() });
    expect(view.mode).toBe('both');
    expect(view.showsDocument).toBe(true);
    expect(view.showsCanvas).toBe(true);
  });

  it('hides the canvas in document mode', () => {
    const view = createViewState({ storage: memoryStorage() });
    view.setMode('document');
    expect(view.showsDocument).toBe(true);
    expect(view.showsCanvas).toBe(false);
  });

  it('hides the document in canvas mode', () => {
    const view = createViewState({ storage: memoryStorage() });
    view.setMode('canvas');
    expect(view.showsDocument).toBe(false);
    expect(view.showsCanvas).toBe(true);
  });

  it('persists the mode', () => {
    const storage = memoryStorage();
    createViewState({ storage }).setMode('canvas');
    expect(createViewState({ storage }).mode).toBe('canvas');
  });

  it('ignores a persisted value that is not a mode', () => {
    const view = createViewState({ storage: memoryStorage({ [VIEW_STATE_KEY]: '{"mode":"sideways"}' }) });
    expect(view.mode).toBe('both');
  });

  // The AI pane is a sidebar, not a view mode: it can be open in any of them.
  it('toggles the AI pane independently of the mode', () => {
    const view = createViewState({ storage: memoryStorage() });
    expect(view.showsAI).toBe(false);
    view.toggleAI();
    expect(view.showsAI).toBe(true);
    view.setMode('canvas');
    expect(view.showsAI).toBe(true);
  });

  it('toggles the file pane independently of the mode', () => {
    const view = createViewState({ storage: memoryStorage() });
    expect(view.showsFiles).toBe(true);
    view.toggleFiles();
    expect(view.showsFiles).toBe(false);
    view.setMode('document');
    expect(view.showsFiles).toBe(false);
  });

  it('survives storage that throws', () => {
    const view = createViewState({ storage: throwing });
    expect(view.mode).toBe('both');
    expect(() => view.setMode('canvas')).not.toThrow();
    expect(view.mode).toBe('canvas');
  });
});
