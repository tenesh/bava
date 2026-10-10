import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSearch } from './search.svelte';
import type { SearchHit } from './space.svelte';

const hit = (path: string): SearchHit => ({
  kind: 'page',
  path,
  name: path.replace(/\.md$/, ''),
  folder: '',
  count: 1,
  best: { where: 'document', text: path, word: 'x', occurrence: 0, element: '' },
});

/** A search whose answers the test releases by hand, in any order. */
function setup() {
  const pending: { query: string; answer: (hits: SearchHit[]) => void }[] = [];
  const ask = vi.fn(
    (query: string) =>
      new Promise<{ hits: SearchHit[]; more: boolean } | null>((resolve) => {
        pending.push({ query, answer: (hits) => resolve({ hits, more: false }) });
      }),
  );
  const open = { path: 'A.md', source: 'typed', scene: { version: 1, elements: [] } };
  const search = createSearch({ search: ask, open: () => open });
  return { search, ask, pending, open };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the search state', () => {
  it('asks 250ms after typing stops, with the open page as it is', async () => {
    const { search, ask, open } = setup();
    search.setQuery('la');
    await vi.advanceTimersByTimeAsync(100);
    search.setQuery('launch');
    await vi.advanceTimersByTimeAsync(249);
    expect(ask).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(ask).toHaveBeenCalledOnce();
    expect(ask).toHaveBeenCalledWith('launch', open);
  });

  // Out-of-order answers flicker: an older query's answer arriving late is dropped.
  it('drops the answer to an older query', async () => {
    const { search, pending } = setup();
    search.setQuery('lau');
    await vi.advanceTimersByTimeAsync(250);
    search.setQuery('launch');
    await vi.advanceTimersByTimeAsync(250);
    pending[1].answer([hit('new.md')]);
    pending[0].answer([hit('old.md')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(search.hits.map((h) => h.path)).toEqual(['new.md']);
  });

  it('clears at once when the query is emptied, without asking', async () => {
    const { search, ask, pending } = setup();
    search.setQuery('launch');
    await vi.advanceTimersByTimeAsync(250);
    pending[0].answer([hit('a.md')]);
    await vi.advanceTimersByTimeAsync(0);
    search.setQuery('  ');
    expect(search.hits).toEqual([]);
    await vi.advanceTimersByTimeAsync(500);
    expect(ask).toHaveBeenCalledOnce();
  });

  it('moves the highlight within the results and starts each answer at the top', async () => {
    const { search, pending } = setup();
    search.setQuery('launch');
    await vi.advanceTimersByTimeAsync(250);
    pending[0].answer([hit('a.md'), hit('b.md'), hit('c.md')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(search.highlighted).toBe(0);
    search.move(-1);
    expect(search.highlighted).toBe(0);
    search.move(1);
    search.move(1);
    search.move(1);
    expect(search.highlighted).toBe(2);
    search.setQuery('launch d');
    await vi.advanceTimersByTimeAsync(250);
    pending[1].answer([hit('a.md'), hit('b.md')]);
    await vi.advanceTimersByTimeAsync(0);
    expect(search.highlighted).toBe(0);
  });

  it('says when the search failed', async () => {
    const ask = vi.fn(async () => null);
    const search = createSearch({ search: ask, open: () => null });
    search.setQuery('launch');
    await vi.advanceTimersByTimeAsync(250);
    expect(search.failed).toBe(true);
    expect(search.hits).toEqual([]);
  });
});
