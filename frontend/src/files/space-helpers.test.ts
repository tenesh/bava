import { describe, expect, it } from 'vitest';
import { folderOf, followMove, formatBytes, launchTarget, pageTitle, spaceChoices, spaceMessage, treeMenu, unsavedBody, within } from './space-helpers';

describe('the open page when something moves', () => {
  it('follows its own rename or move', () => {
    expect(followMove('a.md', 'a.md', 'F/a.md')).toBe('F/a.md');
  });

  it('follows its folder', () => {
    expect(followMove('F/G/a.md', 'F', 'Archive/F')).toBe('Archive/F/G/a.md');
  });

  it('ignores anything else, including a folder with a longer name', () => {
    expect(followMove('Fx/a.md', 'F', 'G')).toBeNull();
    expect(followMove('b.md', 'a.md', 'c.md')).toBeNull();
  });

  it('knows when a trashed folder held it', () => {
    expect(within('F/a.md', 'F')).toBe(true);
    expect(within('F', 'F')).toBe(true);
    expect(within('Fx/a.md', 'F')).toBe(false);
  });
});

describe('a new page goes beside the open one', () => {
  it('uses the open page\'s folder, or the top', () => {
    expect(folderOf('Marketing/Launch plan.md')).toBe('Marketing');
    expect(folderOf('Roadmap.md')).toBe('');
    expect(folderOf(null)).toBe('');
  });
});

describe('launching', () => {
  it('reopens the last Space when its folder is still there', () => {
    expect(launchTarget('/w/Acme', true)).toBe('space');
  });

  it('shows the start screen with no last Space, or one that is gone', () => {
    expect(launchTarget(null, false)).toBe('start');
    expect(launchTarget('/w/Gone', false)).toBe('start');
  });
});

describe('the Files tree\'s menu', () => {
  const ids = (items: ReturnType<typeof treeMenu>) => items.flatMap((i) => (i.kind === 'item' ? [i.id] : []));

  it('offers every action on a page', () => {
    expect(ids(treeMenu('page', (k) => k))).toEqual(['tree.newPage', 'tree.newFolder', 'tree.rename', 'tree.duplicate', 'tree.reveal', 'tree.trash']);
  });

  it('cannot duplicate a folder', () => {
    expect(ids(treeMenu('folder', (k) => k))).not.toContain('tree.duplicate');
  });

  it('only makes things on empty space', () => {
    expect(ids(treeMenu(null, (k) => k))).toEqual(['tree.newPage', 'tree.newFolder']);
  });
});

describe('sizes and titles', () => {
  it('reads bytes as a person would', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(4_200_000)).toBe('4.0 MB');
  });

  it('names a page by its file, without the extension', () => {
    expect(pageTitle('/w/Acme/Marketing/Launch plan.md')).toBe('Launch plan');
    expect(pageTitle(null)).toBeNull();
  });
});

describe('what the shell shows about a Space', () => {
  // The switcher and the start screen list Spaces only, named by their folder.
  it('lists recent Spaces by folder name, marking the missing', () => {
    const recents = [
      { path: '/w/Acme', kind: 'space' as const, openedAt: 1 },
      { path: '/w/Acme/Roadmap.md', kind: 'file' as const, openedAt: 2 },
      { path: '/w/Gone', kind: 'space' as const, openedAt: 3 },
    ];
    expect(spaceChoices(recents, ['/w/Gone'])).toEqual([
      { path: '/w/Acme', name: 'Acme', openedAt: 1, missing: false },
      { path: '/w/Gone', name: 'Gone', openedAt: 3, missing: true },
    ]);
  });

  // The unsaved prompt names the page it is about; an untitled one has no name.
  it('names the page in the unsaved prompt', () => {
    expect(unsavedBody('/w/Acme/Launch plan.md')).toContain('Launch plan');
    expect(unsavedBody(null)).not.toContain('{name}');
  });
});

describe('a refusal from the Space, in the user\'s language', () => {
  it('words a known refusal itself, and shows any other failure as it came', () => {
    expect(spaceMessage({ error: '"b.md" already exists', code: 'exists' })).not.toContain('"b.md"');
    expect(spaceMessage({ error: '"b.md" already exists', code: 'exists' })).not.toBe('');
    expect(spaceMessage({ error: 'permission denied', code: '' })).toBe('permission denied');
    expect(spaceMessage({ error: 'odd', code: 'unheardOf' })).toBe('odd');
  });
});
