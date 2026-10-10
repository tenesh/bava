import { describe, expect, it } from 'vitest';
import { fakeSearch } from './fake-search';
import type { FakeSpace } from '../fixtures/space';

// The same cases as Go's `internal/space/search_test.go`, so the browser
// tests meet the search the app has.
function spaceOf(pages: Record<string, string>, folders: Record<string, string[]>, scenes: Record<string, unknown[]> = {}): FakeSpace {
  return {
    root: '/s',
    pageWidth: '',
    folders,
    pages: Object.fromEntries(Object.entries(pages).map(([path, source]) => [path, { source, scene: { version: 1, elements: scenes[path] ?? [] } }])),
    trash: [],
    attachments: [],
  };
}

describe('fakeSearch', () => {
  it('orders names (folders first), then by count, then the tree', () => {
    const space = spaceOf(
      { 'a.md': 'launch\n', 'b.md': 'launch launch launch\n', 'c.md': 'launch\n', 'Launch.md': 'nothing\n', 'Launch/x.md': 'nothing\n' },
      { '': ['Launch', 'Launch.md', 'a.md', 'b.md', 'c.md'], Launch: ['x.md'] },
    );
    expect(fakeSearch(space, 'launch', null).hits.map((h) => h.path)).toEqual(['Launch', 'Launch.md', 'b.md', 'a.md', 'c.md']);
  });

  it('gives a page its best line, word and occurrence', () => {
    const space = spaceOf({ 'A.md': '# Plan\n\nThe launch.\n\n- The launch date is set.\n\nA launch again.\n' }, { '': ['A.md'] });
    const [hit] = fakeSearch(space, 'launch date', null).hits;
    expect(hit.best).toMatchObject({ where: 'document', text: 'The launch date is set.', word: 'launch', occurrence: 1 });
    expect(hit.count).toBe(4);
  });

  it('names the canvas element when the Document has no match, and needs every word', () => {
    const space = spaceOf({ 'A.md': 'Date.\n' }, { '': ['A.md'] }, { 'A.md': [{ id: 'c', type: 'code', code: 'func launch() {}' }] });
    expect(fakeSearch(space, 'launch', null).hits[0].best).toMatchObject({ where: 'canvas', element: 'c', text: 'func launch() {}' });
    expect(fakeSearch(space, 'launch date', null).hits).toHaveLength(1);
    expect(fakeSearch(space, 'launch nothing', null).hits).toHaveLength(0);
  });

  it('matches the start of words only', () => {
    const space = spaceOf({ 'A.md': 'Bava launches today.\n' }, { '': ['A.md'] });
    expect(fakeSearch(space, 'launch', null).hits).toHaveLength(1);
    expect(fakeSearch(space, 'aunch', null).hits).toHaveLength(0);
  });
});
