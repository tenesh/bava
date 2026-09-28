import { describe, expect, it, vi } from 'vitest';
import { createSpace, type SpaceIO } from './space.svelte';

type Entry = { name: string; path: string; kind: 'page' | 'folder' };

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

/** A fake Space service over a map of folder to entries. */
function fakeIO(folders: Record<string, Entry[]>) {
  const io = {
    open: vi.fn(async (dir: string) => ({ root: dir, name: dir.split('/').pop() ?? '', pageWidth: '', error: '' })),
    list: vi.fn(async (_root: string, folder: string) =>
      folder in folders ? { entries: folders[folder], error: '' } : { entries: null, error: `no folder ${folder}` },
    ),
    apply: vi.fn(async (_root: string, op: { kind: string; folder?: string; name?: string }) => {
      if (op.kind === 'createPage') {
        const path = op.folder ? `${op.folder}/${op.name}.md` : `${op.name}.md`;
        (folders[op.folder ?? ''] ??= []).push({ name: `${op.name}.md`, path, kind: 'page' });
        return { path, id: '', root: '', error: '' };
      }
      return { path: '', id: '', root: '', error: 'refused' };
    }),
    trash: vi.fn(async () => ({ items: [], size: 0, error: '' })),
    chooseFolder: vi.fn(async () => ({ path: '', error: '' })),
    create: vi.fn(async (parent: string, name: string) => ({ root: `${parent}/${name}`, name, pageWidth: '', error: '' })),
    reveal: vi.fn(async () => ({ error: '', code: '' })),
    index: vi.fn(async (_root: string, withText: boolean) => ({
      pages: [{ name: 'Roadmap', path: 'Roadmap.md', text: withText ? '# Roadmap\n' : '' }],
      error: '',
    })),
  };
  return io as typeof io & SpaceIO;
}

const tree = () => ({
  '': [
    { name: 'Marketing', path: 'Marketing', kind: 'folder' as const },
    { name: 'Roadmap.md', path: 'Roadmap.md', kind: 'page' as const },
  ],
  Marketing: [{ name: 'Launch plan.md', path: 'Marketing/Launch plan.md', kind: 'page' as const }],
});

describe('a Space', () => {
  it('opens a folder and lists its top level', async () => {
    const space = createSpace(fakeIO(tree()), { storage: memoryStorage() });
    await space.open('/w/Acme');
    expect(space.root).toBe('/w/Acme');
    expect(space.name).toBe('Acme');
    expect(space.rows.map((r) => [r.entry.name, r.depth])).toEqual([
      ['Marketing', 0],
      ['Roadmap.md', 0],
    ]);
  });

  it('shows a folder when expanded, and remembers it for the next time', async () => {
    const storage = memoryStorage();
    const space = createSpace(fakeIO(tree()), { storage });
    await space.open('/w/Acme');
    await space.toggle('Marketing');
    expect(space.rows.map((r) => [r.entry.name, r.depth])).toEqual([
      ['Marketing', 0],
      ['Launch plan.md', 1],
      ['Roadmap.md', 0],
    ]);

    const again = createSpace(fakeIO(tree()), { storage });
    await again.open('/w/Acme');
    expect(again.isExpanded('Marketing')).toBe(true);
    expect(again.rows).toHaveLength(3);
  });

  it('collapses a folder', async () => {
    const space = createSpace(fakeIO(tree()), { storage: memoryStorage() });
    await space.open('/w/Acme');
    await space.toggle('Marketing');
    await space.toggle('Marketing');
    expect(space.rows).toHaveLength(2);
  });

  // A new page is named in the tree first, then opened.
  it('names a new page in its folder before making it', async () => {
    const io = fakeIO(tree());
    const space = createSpace(io, { storage: memoryStorage() });
    await space.open('/w/Acme');
    space.beginNew('page', 'Marketing');
    expect(space.isExpanded('Marketing')).toBe(true);
    expect(space.pending).toEqual({ kind: 'page', folder: 'Marketing' });
    const made = await space.commitNew('Budget');
    expect(made).toEqual({ path: 'Marketing/Budget.md', error: '' });
    expect(io.apply).toHaveBeenCalledWith('/w/Acme', expect.objectContaining({ kind: 'createPage', folder: 'Marketing', name: 'Budget' }));
    expect(space.pending).toBeNull();
    expect(space.rows.some((r) => r.entry.path === 'Marketing/Budget.md')).toBe(true);
  });

  it('cancels naming a new page', async () => {
    const space = createSpace(fakeIO(tree()), { storage: memoryStorage() });
    await space.open('/w/Acme');
    space.beginNew('folder', '');
    space.cancelNew();
    expect(space.pending).toBeNull();
  });

  it('reports a refused operation and changes nothing', async () => {
    const space = createSpace(fakeIO(tree()), { storage: memoryStorage() });
    await space.open('/w/Acme');
    const result = await space.apply({ kind: 'rename', path: 'Roadmap.md', name: 'x' });
    expect(result.error).toBe('refused');
    expect(space.rows).toHaveLength(2);
  });

  // An expanded folder that is gone (renamed in Finder) drops out quietly.
  it('refreshes, forgetting folders that are gone', async () => {
    const folders = tree();
    const space = createSpace(fakeIO(folders), { storage: memoryStorage() });
    await space.open('/w/Acme');
    await space.toggle('Marketing');
    delete (folders as Record<string, Entry[]>).Marketing;
    folders[''] = [folders[''][1]];
    await space.refresh();
    expect(space.rows.map((r) => r.entry.name)).toEqual(['Roadmap.md']);
    expect(space.isExpanded('Marketing')).toBe(false);
  });

  it('remembers the last page opened in it', async () => {
    const storage = memoryStorage();
    const space = createSpace(fakeIO(tree()), { storage });
    await space.open('/w/Acme');
    space.rememberPage('Marketing/Launch plan.md');
    const again = createSpace(fakeIO(tree()), { storage });
    await again.open('/w/Acme');
    expect(again.lastPage).toBe('Marketing/Launch plan.md');
  });

  it('gives a page path relative to the Space, or null outside it', async () => {
    const space = createSpace(fakeIO(tree()), { storage: memoryStorage() });
    await space.open('/w/Acme');
    expect(space.relative('/w/Acme/Marketing/Launch plan.md')).toBe('Marketing/Launch plan.md');
    expect(space.relative('/elsewhere/x.md')).toBeNull();
    expect(space.absolute('Roadmap.md')).toBe('/w/Acme/Roadmap.md');
  });
});

describe('a Space, under refusals, moves and overlapping refreshes', () => {
  // A name that is refused keeps the row being named, as a new object, so the
  // tree starts naming it again.
  it('keeps the new row after a refused name, ready to name again', async () => {
    const io = fakeIO(tree());
    io.apply.mockResolvedValueOnce({ path: '', id: '', root: '', error: 'exists' });
    const space = createSpace(io, { storage: memoryStorage() });
    await space.open('/w/Acme');
    space.beginNew('page', '');
    const before = space.pending;
    const made = await space.commitNew('Roadmap');
    expect(made.error).toBe('exists');
    expect(space.pending).toEqual(before);
    expect(space.pending).not.toBe(before);
  });

  // Two refreshes in flight: the older answer, landing last, is dropped.
  it('drops a stale listing', async () => {
    const folders = tree();
    const io = fakeIO(folders);
    const space = createSpace(io, { storage: memoryStorage() });
    await space.open('/w/Acme');
    let release!: () => void;
    io.list.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => (release = resolve));
      return { entries: tree()[''], error: '' };
    });
    const old = space.refresh();
    folders[''] = [folders[''][1]];
    await space.refresh();
    release();
    await old;
    expect(space.rows.map((r) => r.entry.name)).toEqual(['Roadmap.md']);
  });

  // An operation's result reaches the caller before the tree is re-read.
  it('reports an operation before refreshing', async () => {
    const io = fakeIO(tree());
    io.apply.mockResolvedValueOnce({ path: 'b.md', id: '', root: '', error: '' });
    const space = createSpace(io, { storage: memoryStorage() });
    await space.open('/w/Acme');
    const listsBefore = io.list.mock.calls.length;
    let seen = -1;
    await space.apply({ kind: 'rename', path: 'a.md', name: 'b' }, { before: () => { seen = io.list.mock.calls.length; } });
    expect(seen).toBe(listsBefore);
    expect(io.list.mock.calls.length).toBeGreaterThan(listsBefore);
  });

  it('keeps a moved folder open', async () => {
    const space = createSpace(fakeIO(tree()), { storage: memoryStorage() });
    await space.open('/w/Acme');
    await space.toggle('Marketing');
    space.followMove('Marketing', 'Archive/Marketing');
    expect(space.isExpanded('Archive/Marketing')).toBe(true);
    expect(space.isExpanded('Marketing')).toBe(false);
  });

  // A renamed Space keeps its open folders and last page under its new root.
  it('carries its conveniences to a new root', async () => {
    const storage = memoryStorage();
    const space = createSpace(fakeIO(tree()), { storage });
    await space.open('/w/Acme');
    await space.toggle('Marketing');
    space.rememberPage('Roadmap.md');
    space.carryTo('/w/Acme Two');
    const again = createSpace(fakeIO(tree()), { storage });
    await again.open('/w/Acme Two');
    expect(again.isExpanded('Marketing')).toBe(true);
    expect(again.lastPage).toBe('Roadmap.md');
  });

  // A folder closed while a refresh is reading it stays closed.
  it('keeps a folder closed during a refresh closed', async () => {
    const io = fakeIO(tree());
    const space = createSpace(io, { storage: memoryStorage() });
    await space.open('/w/Acme');
    await space.toggle('Marketing');
    let release!: () => void;
    io.list.mockImplementation(async (_root: string, folder: string) => {
      if (folder === 'Marketing') await new Promise<void>((resolve) => (release = resolve));
      return { entries: tree()[folder as '' | 'Marketing'], error: '' };
    });
    const refreshing = space.refresh();
    await vi.waitFor(() => expect(release).toBeDefined());
    await space.toggle('Marketing');
    release();
    await refreshing;
    expect(space.isExpanded('Marketing')).toBe(false);
    expect(space.rows.map((r) => r.entry.name)).not.toContain('Launch plan.md');
  });

  it('makes a new Space folder in the place chosen', async () => {
    const io = fakeIO(tree());
    const space = createSpace(io, { storage: memoryStorage() });
    expect(await space.create('/w', 'Acme')).toEqual({ root: '/w/Acme', error: '' });
    expect(io.create).toHaveBeenCalledWith('/w', 'Acme');
  });

  it('words a refused new Space', async () => {
    const io = fakeIO(tree());
    io.create.mockResolvedValueOnce({ root: '', name: '', pageWidth: '', error: '"Acme" already exists', code: 'exists' } as never);
    const space = createSpace(io, { storage: memoryStorage() });
    const made = await space.create('/w', 'Acme');
    expect(made.root).toBe('');
    expect(made.error).not.toContain('"Acme"');
  });

  // The tree must not see a new listing while the row being named is still
  // there, or it starts naming that row again.
  it('stops naming before it re-reads the tree', async () => {
    const io = fakeIO(tree());
    const space = createSpace(io, { storage: memoryStorage() });
    await space.open('/w/Acme');
    space.beginNew('page', '');
    let pendingWhenListed: unknown = 'not listed';
    io.list.mockImplementationOnce(async (_root: string, folder: string) => {
      pendingWhenListed = space.pending;
      return { entries: tree()[folder as ''] ?? [], error: '' };
    });
    await space.commitNew('Budget');
    expect(pendingWhenListed).toBeNull();
  });

  it('words a refused reveal', async () => {
    const io = fakeIO(tree());
    io.reveal.mockResolvedValueOnce({ error: 'showing folders is unavailable', code: 'revealUnavailable' });
    const space = createSpace(io, { storage: memoryStorage() });
    await space.open('/w/Acme');
    const message = await space.reveal();
    expect(typeof message).toBe('string');
    expect(message).not.toBe('');
    expect(message).not.toBe('showing folders is unavailable');
  });
});

describe("a Space's index", () => {
  it('lists the pages, with their text when asked', async () => {
    const io = fakeIO(tree());
    const space = createSpace(io, { storage: memoryStorage() });
    await space.open('/w/Acme');
    const pages = await space.index(true);
    expect(io.index).toHaveBeenCalledWith('/w/Acme', true);
    expect(pages).toEqual([{ name: 'Roadmap', path: 'Roadmap.md', text: '# Roadmap\n' }]);
  });

  it('is empty with no Space open, and unknown when reading fails', async () => {
    const io = fakeIO(tree());
    const space = createSpace(io, { storage: memoryStorage() });
    expect(await space.index(false)).toEqual([]);
    await space.open('/w/Acme');
    io.index.mockResolvedValueOnce({ pages: null as never, error: 'unreadable' });
    expect(await space.index(false)).toBeNull();
    io.index.mockRejectedValueOnce(new Error('the app is closing'));
    expect(await space.index(false)).toBeNull();
  });

  it('passes on the pages relink could not write', async () => {
    const io = fakeIO(tree());
    io.apply.mockResolvedValueOnce({ path: '', id: '', root: '', error: '', missed: ['Plan.md'] } as never);
    const space = createSpace(io, { storage: memoryStorage() });
    await space.open('/w/Acme');
    const outcome = await space.apply({ kind: 'relink', edits: [{ path: 'Plan.md', before: 'a', after: 'b' }] });
    expect(outcome.missed).toEqual(['Plan.md']);
  });
});
