import { describe, expect, it } from 'vitest';
import { dropTarget, zoneAt, treeRoot, PENDING } from './tree';
import type { SpaceEntry, TreeRow } from './space.svelte';

const e = (path: string, kind: 'page' | 'folder' = 'page'): SpaceEntry => ({ name: path.split('/').pop()!, path, kind });
const rows: TreeRow[] = [
  { entry: e('Marketing', 'folder'), depth: 0 },
  { entry: e('Marketing/Launch plan.md'), depth: 1 },
  { entry: e('Marketing/Brand.md'), depth: 1 },
  { entry: e('Roadmap.md'), depth: 0 },
  { entry: e('Notes.md'), depth: 0 },
];

describe('where a dragged row lands', () => {
  it('goes into a folder dropped on its middle, at the end', () => {
    expect(dropTarget(rows, 'Marketing', 'inside', 'Roadmap.md')).toEqual({ folder: 'Marketing', index: -1 });
  });

  it('goes before or after a row, in that row\'s folder', () => {
    expect(dropTarget(rows, 'Marketing/Brand.md', 'before', 'Notes.md')).toEqual({ folder: 'Marketing', index: 1 });
    expect(dropTarget(rows, 'Marketing/Brand.md', 'after', 'Notes.md')).toEqual({ folder: 'Marketing', index: 2 });
  });

  it('counts positions without the dragged row when it stays in its folder', () => {
    // Roadmap sits at 1 among the top level; moving it after Notes puts it last.
    expect(dropTarget(rows, 'Notes.md', 'after', 'Roadmap.md')).toEqual({ folder: '', index: 2 });
    expect(dropTarget(rows, 'Marketing', 'before', 'Notes.md')).toEqual({ folder: '', index: 0 });
  });

  it('refuses a drop onto itself, into itself, or into what it holds', () => {
    expect(dropTarget(rows, 'Roadmap.md', 'after', 'Roadmap.md')).toBeNull();
    expect(dropTarget(rows, 'Marketing', 'inside', 'Marketing')).toBeNull();
    expect(dropTarget(rows, 'Marketing/Brand.md', 'before', 'Marketing')).toBeNull();
  });

  it('refuses dropping inside a page', () => {
    expect(dropTarget(rows, 'Notes.md', 'inside', 'Roadmap.md')).toBeNull();
  });
});

describe('which part of a row the pointer is over', () => {
  it('splits a page row in halves, a folder row in quarters', () => {
    expect(zoneAt(3, 26, false)).toBe('before');
    expect(zoneAt(20, 26, false)).toBe('after');
    expect(zoneAt(3, 26, true)).toBe('before');
    expect(zoneAt(13, 26, true)).toBe('inside');
    expect(zoneAt(24, 26, true)).toBe('after');
  });
});

describe('the tree the TreeView shows', () => {
  it('makes every folder a branch, loaded or not, and adds the row being named', () => {
    const root = treeRoot(
      { '': [e('Marketing', 'folder'), e('Roadmap.md')], Marketing: [e('Marketing/Launch plan.md')] },
      { kind: 'page', folder: 'Marketing' },
      { page: 'Untitled', folder: 'New folder' },
    );
    expect(root.children.map((n) => n.value)).toEqual(['Marketing', 'Roadmap.md']);
    const marketing = root.children[0];
    expect(marketing.childrenCount).toBe(2);
    expect(marketing.children?.map((n) => n.value)).toEqual(['Marketing/Launch plan.md', PENDING]);
    expect(root.children[1].children).toBeUndefined();
  });

  it('gives an unloaded folder a branch with no children yet', () => {
    const root = treeRoot({ '': [e('Empty', 'folder')] }, null, { page: 'Untitled', folder: 'New folder' });
    expect(root.children[0].children).toEqual([]);
    expect(root.children[0].childrenCount).toBe(0);
  });
});

describe('the row being named, in the user\'s language', () => {
  it('takes its placeholder names from the caller', () => {
    const root = treeRoot({ '': [] }, { kind: 'folder', folder: '' }, { page: 'Sans titre', folder: 'Nouveau dossier' });
    expect(root.children[0].name).toBe('Nouveau dossier');
  });
});

describe('a page being named from a template', () => {
  it('starts with the template\'s name', () => {
    const root = treeRoot({ '': [] }, { kind: 'page', folder: '', name: 'Weekly sync' }, { page: 'Untitled', folder: 'New folder' });
    expect(root.children[0]).toMatchObject({ value: PENDING, name: 'Weekly sync' });
  });
});

