/**
 * The shell's small decisions about a Space, apart from the markup, so they
 * are tested on data: which page follows a move, where a new page goes, what
 * launch shows, what the tree's menu offers.
 */
import type { MenuNode } from '../canvas/context-menu';
import type { EntryKind } from './space.svelte';
import { t } from '../i18n/t';
import type { Recent } from './recents.svelte';

/**
 * The open page's path after something moved from `from` to `to`, all
 * relative to the Space: itself, or a folder it is in. Null when the move did
 * not touch it.
 */
export function followMove(open: string, from: string, to: string): string | null {
  if (open === from) return to;
  if (open.startsWith(from + '/')) return to + open.slice(from.length);
  return null;
}

/** Whether a path is `folder` or inside it. */
export function within(path: string, folder: string): boolean {
  return path === folder || path.startsWith(folder + '/');
}

/** The folder a page is in, relative to the Space ("" for the top). */
export function folderOf(path: string | null): string {
  if (!path || !path.includes('/')) return '';
  return path.slice(0, path.lastIndexOf('/'));
}

/** What launch shows: the last Space when its folder still exists, else the start screen. */
export function launchTarget(lastSpace: string | null, exists: boolean): 'space' | 'start' {
  return lastSpace && exists ? 'space' : 'start';
}

/** The Files tree's right-click menu for a page, a folder, or empty space (null). */
export function treeMenu(kind: EntryKind | null, label: (key: string) => string): MenuNode[] {
  const item = (id: string): MenuNode => ({ kind: 'item', id, label: label(id), keys: '' });
  const make = [item('tree.newPage'), item('tree.newFolder')];
  if (kind === null) return make;
  return [
    ...make,
    { kind: 'separator' },
    item('tree.rename'),
    ...(kind === 'page' ? [item('tree.duplicate')] : []),
    item('tree.reveal'),
    { kind: 'separator' },
    item('tree.trash'),
  ];
}

/** Bytes as a person reads them. */
export function formatBytes(bytes: number): string {
  const unit = (key: 'size.kb' | 'size.mb' | 'size.gb', n: number) => t(key).replace('{n}', n.toFixed(1));
  if (bytes < 1024) return t('size.bytes').replace('{n}', String(bytes));
  if (bytes < 1024 * 1024) return unit('size.kb', bytes / 1024);
  if (bytes < 1024 * 1024 * 1024) return unit('size.mb', bytes / (1024 * 1024));
  return unit('size.gb', bytes / (1024 * 1024 * 1024));
}

/** A page's name as the title bar shows it: its file name without `.md`. */
export function pageTitle(path: string | null): string | null {
  if (!path) return null;
  return path.split(/[\\/]/).pop()!.replace(/\.md$/i, '');
}

/** The recent Spaces the switcher and start screen offer, named by their folder. */
export function spaceChoices(
  recents: Recent[],
  missing: string[],
): { path: string; name: string; openedAt: number; missing: boolean }[] {
  return recents
    .filter((entry) => entry.kind === 'space')
    .map((entry) => ({
      path: entry.path,
      name: pageTitle(entry.path) ?? entry.path,
      openedAt: entry.openedAt,
      missing: missing.includes(entry.path),
    }));
}

/** The unsaved prompt's body: it names the page, or speaks of an untitled one. */
export function unsavedBody(path: string | null): string {
  return path ? t('file.unsaved.page').replace('{name}', pageTitle(path) ?? '') : t('file.unsaved.body');
}

// Refusals Go names by code (internal/space/errors.go), worded here.
const REFUSALS = {
  exists: 'space.error.exists',
  nameEmpty: 'space.error.nameEmpty',
  nameSlash: 'space.error.nameSlash',
  nameDot: 'space.error.nameDot',
  nameReserved: 'space.error.nameReserved',
  intoItself: 'space.error.intoItself',
  notFolder: 'space.error.notFolder',
  onlyPage: 'space.error.onlyPage',
  outside: 'space.error.outside',
  throughLink: 'space.error.throughLink',
  notSpace: 'space.error.notSpace',
  notAttachment: 'space.error.notAttachment',
  revealUnavailable: 'space.error.revealUnavailable',
} as const;

/**
 * A failure from the Space service as the user reads it: a known refusal in
 * their language, anything else (a file system error) as it came.
 */
export function spaceMessage(result: { error: string; code?: string }): string {
  const key = result.code ? REFUSALS[result.code as keyof typeof REFUSALS] : undefined;
  return key ? t(key) : result.error;
}

/**
 * Space settings, saved in order: the width is written into the Space's
 * folder, so it goes before a rename moves that folder.
 */
export async function saveSpaceSettings(
  changes: { name?: string; width?: string },
  apply: { setWidth: (width: string) => Promise<void>; rename: (name: string) => Promise<void> },
): Promise<void> {
  if (changes.width !== undefined) await apply.setWidth(changes.width);
  if (changes.name !== undefined) await apply.rename(changes.name);
}

/** What to tell the user about pages whose links a rename or move could not update; null for none. */
export function linksMissedMessage(missed: string[]): string | null {
  if (missed.length === 0) return null;
  if (missed.includes('')) return t('links.missedSpace');
  return missed.length === 1 ? t('links.missed.one') : t('links.missed').replace('{count}', String(missed.length));
}
