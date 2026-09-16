import { describe, expect, it, vi } from 'vitest';
import { createPaneSizes, PANE_SIZES_KEY } from './pane-sizes.svelte';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('SecurityError');
  },
};

const DEFAULTS = { files: 18, main: 62, ai: 20 };

describe('pane sizes', () => {
  it('starts from the defaults', () => {
    const sizes = createPaneSizes({ storage: memoryStorage(), defaults: DEFAULTS });
    expect(sizes.current).toEqual(DEFAULTS);
  });

  it('persists a change', () => {
    const storage = memoryStorage();
    const spy = vi.spyOn(storage, 'setItem');
    const sizes = createPaneSizes({ storage, defaults: DEFAULTS });
    sizes.set({ files: 25, main: 55, ai: 20 });
    expect(spy).toHaveBeenCalledWith(PANE_SIZES_KEY, JSON.stringify({ files: 25, main: 55, ai: 20 }));
  });

  it('restores persisted sizes', () => {
    const sizes = createPaneSizes({
      storage: memoryStorage({ [PANE_SIZES_KEY]: JSON.stringify({ files: 30, main: 50, ai: 20 }) }),
      defaults: DEFAULTS,
    });
    expect(sizes.current.files).toBe(30);
  });

  // Pane widths are a convenience. A private window makes localStorage throw,
  // and that must cost the convenience, not the app.
  it('falls back to defaults when storage throws', () => {
    const sizes = createPaneSizes({ storage: throwingStorage, defaults: DEFAULTS });
    expect(sizes.current).toEqual(DEFAULTS);
    expect(() => sizes.set({ files: 25, main: 55, ai: 20 })).not.toThrow();
    expect(sizes.current.files).toBe(25);
  });

  it('ignores malformed persisted data', () => {
    const sizes = createPaneSizes({
      storage: memoryStorage({ [PANE_SIZES_KEY]: 'not json' }),
      defaults: DEFAULTS,
    });
    expect(sizes.current).toEqual(DEFAULTS);
  });

  // A persisted value written by a future version could be missing a pane.
  it('ignores persisted data missing a pane', () => {
    const sizes = createPaneSizes({
      storage: memoryStorage({ [PANE_SIZES_KEY]: JSON.stringify({ files: 30 }) }),
      defaults: DEFAULTS,
    });
    expect(sizes.current).toEqual(DEFAULTS);
  });
});
