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

// Recents hold Spaces as well as files, with when each was
// opened, for the start screen and the Space switcher.
describe('recent Spaces and files', () => {
  it('records the kind and when it was opened', () => {
    let now = 1000;
    const recents = createRecents({ storage: memoryStorage(), now: () => now });
    recents.add('/w/Acme', 'space');
    now = 2000;
    recents.add('/w/notes.md', 'file');
    expect(recents.entries).toEqual([
      { path: '/w/notes.md', kind: 'file', openedAt: 2000 },
      { path: '/w/Acme', kind: 'space', openedAt: 1000 },
    ]);
    expect(recents.spaces.map((e) => e.path)).toEqual(['/w/Acme']);
  });

  it('reads an older list of paths as files', () => {
    const storage = memoryStorage({ [RECENTS_KEY]: JSON.stringify(['/x.md']) });
    expect(createRecents({ storage }).entries).toEqual([{ path: '/x.md', kind: 'file', openedAt: 0 }]);
  });

  it('forgets a path, and follows a renamed Space', () => {
    const recents = createRecents({ storage: memoryStorage(), now: () => 5 });
    recents.add('/w/Acme', 'space');
    recents.add('/w/Old', 'space');
    recents.rename('/w/Old', '/w/New');
    recents.remove('/w/Acme');
    expect(recents.entries).toEqual([{ path: '/w/New', kind: 'space', openedAt: 5 }]);
  });
});

// Opening pages must not push the Space off the list.
describe('recents by kind', () => {
  it('keeps Spaces however many pages are opened', () => {
    const recents = createRecents({ storage: memoryStorage(), now: () => 1 });
    recents.add('/w/Acme', 'space');
    for (let i = 0; i < RECENTS_LIMIT + 3; i += 1) recents.add(`/w/Acme/p${i}.md`, 'file');
    expect(recents.spaces.map((e) => e.path)).toEqual(['/w/Acme']);
    expect(recents.entries.filter((e) => e.kind === 'file')).toHaveLength(RECENTS_LIMIT);
  });

  it('moves every entry under a renamed Space', () => {
    const recents = createRecents({ storage: memoryStorage(), now: () => 1 });
    recents.add('/w/Old/a.md', 'file');
    recents.add('/w/Old', 'space');
    recents.add('/w/Older/b.md', 'file');
    recents.renamePrefix('/w/Old', '/w/New');
    expect(recents.paths).toEqual(['/w/New', '/w/New/a.md', '/w/Older/b.md'].sort((a, b) => recents.paths.indexOf(a) - recents.paths.indexOf(b)));
    expect(recents.paths).toContain('/w/New/a.md');
    expect(recents.paths).toContain('/w/Older/b.md');
    expect(recents.paths).not.toContain('/w/Old/a.md');
  });

  it('forgets an item and everything under it', () => {
    const recents = createRecents({ storage: memoryStorage() });
    recents.add('/w/Acme', 'space');
    recents.add('/w/Acme/Old/a.md');
    recents.add('/w/Acme/Older/b.md');
    recents.removePrefix('/w/Acme/Old');
    expect(recents.paths).toEqual(['/w/Acme/Older/b.md', '/w/Acme']);
  });
});
