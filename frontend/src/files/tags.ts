/**
 * Tags across a Space: each tag with the pages that have it, a page's text
 * with its tags renamed, merged or deleted (its `tags` key alone changed),
 * and the Files tree narrowed to the pages that have chosen tags.
 */
import { frontOf, normaliseTag, withFront } from '../docs/markdown';
import type { SpaceEntry, TreeRow } from './space.svelte';
import type { PageText } from './embeds';

/** One tag and the pages that have it, by their path in the Space. */
export type TagUse = { tag: string; pages: string[] };

/** Every tag in the pages, by name, each with the pages that have it in the order given. */
export function tagsIn(pages: PageText[]): TagUse[] {
  const byTag = new Map<string, string[]>();
  for (const page of pages) {
    for (const tag of frontOf(page.text).front.tags) byTag.set(tag, [...(byTag.get(tag) ?? []), page.path]);
  }
  return [...byTag].map(([tag, paths]) => ({ tag, pages: paths })).sort((a, b) => a.tag.localeCompare(b.tag));
}

/**
 * The page's text with each of `from` made `to` (or taken off, for null),
 * kept once; only the `tags` key changes. Null when the page has none of them.
 */
export function retag(text: string, from: string[], to: string | null): string | null {
  const { front, body } = frontOf(text);
  const gone = new Set(from.map(normaliseTag));
  if (!front.tags.some((tag) => gone.has(tag))) return null;
  const into = to === null ? null : normaliseTag(to);
  const tags: string[] = [];
  for (const tag of front.tags) {
    const next = gone.has(tag) ? into : tag;
    if (next !== null && !tags.includes(next)) tags.push(next);
  }
  return withFront({ ...front, tags }, body);
}

/**
 * The tree's rows for the pages that have every one of `chosen`, with the
 * folders that lead to them. Each folder's children keep the order `order`
 * gives (the tree's own, where it has read that folder), else by name.
 */
export function filteredRows(pages: PageText[], chosen: string[], order: (folder: string) => string[] | undefined): TreeRow[] {
  const wanted = chosen.map(normaliseTag);
  const matching = pages.filter((page) => {
    const tags = frontOf(page.text).front.tags;
    return wanted.every((tag) => tags.includes(tag));
  });
  // Each folder's children: the folders on the way to each match, and the match.
  const children = new Map<string, Map<string, SpaceEntry>>();
  const add = (folder: string, entry: SpaceEntry) => {
    const inFolder = children.get(folder) ?? new Map<string, SpaceEntry>();
    inFolder.set(entry.name, entry);
    children.set(folder, inFolder);
  };
  for (const page of matching) {
    const parts = page.path.split('/');
    for (let i = 0; i < parts.length - 1; i += 1) {
      const folder = parts.slice(0, i).join('/');
      add(folder, { name: parts[i], path: parts.slice(0, i + 1).join('/'), kind: 'folder' });
    }
    add(parts.slice(0, -1).join('/'), { name: parts[parts.length - 1], path: page.path, kind: 'page' });
  }
  const rows: TreeRow[] = [];
  const walk = (folder: string, depth: number) => {
    const entries = [...(children.get(folder)?.values() ?? [])];
    const known = order(folder);
    const rank = (entry: SpaceEntry) => {
      const at = known?.indexOf(entry.name) ?? -1;
      return at < 0 ? Infinity : at;
    };
    entries.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    for (const entry of entries) {
      rows.push({ entry, depth });
      if (entry.kind === 'folder') walk(entry.path, depth + 1);
    }
  };
  walk('', 0);
  return rows;
}

/** Each page but the open one that `retag` changes, as `relink` writes it: only if it still reads as before. */
export function tagEdits(pages: PageText[], open: string | null, from: string[], to: string | null): { path: string; before: string; after: string }[] {
  const edits: { path: string; before: string; after: string }[] = [];
  for (const page of pages) {
    if (page.path === open || isLocked(page.text)) continue;
    const after = retag(page.text, from, to);
    if (after !== null) edits.push({ path: page.path, before: page.text, after });
  }
  return edits;
}

/** Whether a page is locked: read-only, its tags included. */
const isLocked = (text: string) => frontOf(text).front.settings.locked === true;

/** The locked pages that have any of the tags: a change across the Space leaves them as they are. */
export function lockedWith(pages: PageText[], tags: string[]): string[] {
  const wanted = new Set(tags);
  return pages.filter((page) => isLocked(page.text) && frontOf(page.text).front.tags.some((tag) => wanted.has(tag))).map((page) => page.path);
}

/** How many pages have any of the tags. */
export function pagesWith(uses: TagUse[], tags: string[]): number {
  return new Set(uses.filter((use) => tags.includes(use.tag)).flatMap((use) => use.pages)).size;
}

/** The tree's folders as `filteredRows` leaves them: each folder's entries, in the rows' order. */
export function foldersOf(rows: TreeRow[]): Record<string, SpaceEntry[]> {
  const folders: Record<string, SpaceEntry[]> = { '': [] };
  for (const { entry } of rows) {
    const at = entry.path.lastIndexOf('/');
    const folder = at < 0 ? '' : entry.path.slice(0, at);
    (folders[folder] ??= []).push(entry);
    if (entry.kind === 'folder') folders[entry.path] ??= [];
  }
  return folders;
}
