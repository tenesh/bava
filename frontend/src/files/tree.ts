/**
 * The Files tree's rules, apart from its markup: the nodes Ark's TreeView is
 * handed, and where a dragged row lands. Pure, so they are tested on data.
 */
import type { EntryKind, SpaceEntry, TreeRow } from './space.svelte';

/** The value of the row being named before it exists. */
export const PENDING = '\u0000new';

export type TreeNodeData = {
  value: string;
  name: string;
  kind: EntryKind;
  children?: TreeNodeData[];
  /** Set on every folder, loaded or not, so the TreeView treats it as a branch. */
  childrenCount?: number;
};

export type DropZone = 'before' | 'inside' | 'after';

/** The TreeView's root: each listed folder's entries, with the row being named. */
export function treeRoot(
  folders: Record<string, SpaceEntry[]>,
  pending: { kind: EntryKind; folder: string } | null,
  /** The placeholder names a new row starts with, in the user's language. */
  labels: { page: string; folder: string },
): { value: string; name: string; kind: EntryKind; children: TreeNodeData[] } {
  const build = (folder: string): TreeNodeData[] => {
    const nodes: TreeNodeData[] = (folders[folder] ?? []).map((entry) => {
      if (entry.kind !== 'folder') return { value: entry.path, name: entry.name, kind: entry.kind };
      const children = build(entry.path);
      return { value: entry.path, name: entry.name, kind: entry.kind, children, childrenCount: children.length };
    });
    if (pending && pending.folder === folder) {
      nodes.push({ value: PENDING, name: pending.kind === 'page' ? labels.page : labels.folder, kind: pending.kind });
    }
    return nodes;
  };
  return { value: '', name: '', kind: 'folder', children: build('') };
}

/** Which part of a row the pointer is over: halves for a page, quarters for a folder. */
export function zoneAt(offsetY: number, height: number, isFolder: boolean): DropZone {
  if (!isFolder) return offsetY < height / 2 ? 'before' : 'after';
  if (offsetY < height / 4) return 'before';
  if (offsetY > (height * 3) / 4) return 'after';
  return 'inside';
}

const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/**
 * Where a row dropped on another lands: a folder and an index in its order
 * (-1 for the end), or null when the drop means nothing or is not allowed.
 */
export function dropTarget(
  rows: TreeRow[],
  overPath: string,
  zone: DropZone,
  draggedPath: string,
): { folder: string; index: number } | null {
  const over = rows.find((row) => row.entry.path === overPath);
  if (!over || overPath === draggedPath) return null;
  const into = (folder: string) => folder === draggedPath || folder.startsWith(draggedPath + '/');
  if (zone === 'inside') {
    if (over.entry.kind !== 'folder' || into(overPath)) return null;
    return { folder: overPath, index: -1 };
  }
  const folder = parentOf(overPath);
  if (into(folder)) return null;
  const siblings = rows
    .filter((row) => parentOf(row.entry.path) === folder && row.entry.path !== draggedPath)
    .map((row) => row.entry.path);
  const at = siblings.indexOf(overPath);
  return { folder, index: zone === 'before' ? at : at + 1 };
}
