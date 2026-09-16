import { describe, expect, it } from 'vitest';
import { createRecents, RECENTS_KEY, RECENTS_LIMIT } from './recents.svelte';

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

describe('recent files', () => {
  it('records the most recent first', () => {
    const recents = createRecents({ storage: memoryStorage() });
    recents.add('/a.md');
    recents.add('/b.md');
    expect(recents.paths).toEqual(['/b.md', '/a.md']);
  });

  it('moves a repeat to the front rather than duplicating it', () => {
    const recents = createRecents({ storage: memoryStorage() });
    recents.add('/a.md');
    recents.add('/b.md');
    recents.add('/a.md');
    expect(recents.paths).toEqual(['/a.md', '/b.md']);
  });

  it('keeps the list bounded', () => {
    const recents = createRecents({ storage: memoryStorage() });
    for (let i = 0; i < RECENTS_LIMIT + 5; i += 1) recents.add(`/f${i}.md`);
    expect(recents.paths).toHaveLength(RECENTS_LIMIT);
  });

  it('restores what was persisted', () => {
    const storage = memoryStorage({ [RECENTS_KEY]: JSON.stringify(['/x.md']) });
    expect(createRecents({ storage }).paths).toEqual(['/x.md']);
  });

  it('ignores malformed persisted data', () => {
    const storage = memoryStorage({ [RECENTS_KEY]: 'not json' });
    expect(createRecents({ storage }).paths).toEqual([]);
  });

  it('ignores persisted data that is not a list of strings', () => {
    const storage = memoryStorage({ [RECENTS_KEY]: JSON.stringify([1, 2, 3]) });
    expect(createRecents({ storage }).paths).toEqual([]);
  });

  // Recents are a convenience. A private window must cost the convenience,
  // not the app.
  it('survives storage that throws', () => {
    const recents = createRecents({ storage: throwing });
    expect(recents.paths).toEqual([]);
    expect(() => recents.add('/a.md')).not.toThrow();
    expect(recents.paths).toEqual(['/a.md']);
  });
});
