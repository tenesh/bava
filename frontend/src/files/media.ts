/**
 * The Space's attachments as Media shows them: each file's kind, the pages
 * that use it, and whether it is unused, worked out from the pages' text,
 * never stored.
 *
 * "Unused" is what "Move unused to Trash" acts on, so a mistake must only
 * ever go the other way: a file counts as used when the Document's reader
 * finds it (`pageLinks`), and also when a page's text names it anywhere at
 * all (in a line, a table, a heading, HTML, by reference; encoded, in any
 * case or accent form). And nothing is unused until every page was read.
 */
import { mediaKind, pageLinks } from '../docs/markdown';
import { resolveLink } from '../docs/links';

const ATTACHMENTS = '.bava/attachments/';

export type AttachmentFile = { name: string; size: number; modified: string };
export type PageText = { name: string; path: string; text: string; unreadable?: boolean };
export type PageRef = { name: string; path: string };

export type MediaKind = 'image' | 'video' | 'pdf' | 'other';

export type MediaItem = AttachmentFile & {
  kind: MediaKind;
  /** The pages that use it, in the order listed. */
  usedBy: PageRef[];
  unused: boolean;
  /** A video's poster, from a page that shows it: its name in the attachments. */
  poster: string | null;
};

function kindOf(name: string): MediaKind {
  const media = mediaKind(name);
  if (media) return media;
  return /\.pdf$/i.test(name) ? 'pdf' : 'other';
}

/** The attachment an address in a page reaches, by its name; null for anything else. */
function attachmentAt(page: string, href: string): string | null {
  const target = resolveLink(page, href)?.target;
  if (!target?.startsWith(ATTACHMENTS)) return null;
  const name = target.slice(ATTACHMENTS.length);
  return name && !name.includes('/') ? name : null;
}

/** Text as names are compared: one Unicode form, one case. */
const folded = (text: string) => text.normalize('NFC').toLowerCase();

/** The ways a page's text may write a file's name. */
function writings(name: string): string[] {
  const plain = folded(name);
  const forms = [plain, plain.replace(/ /g, '%20'), encodeURI(plain), encodeURIComponent(plain), plain.replace(/&/g, '&amp;')];
  return [...new Set(forms.map(folded))];
}

/** What is known of use: each attachment, and whether every page was read (else no file is called unused). */
export function mediaUsage(files: AttachmentFile[], pages: PageText[] | null): { items: MediaItem[]; known: boolean } {
  const known = pages !== null && pages.every((page) => !page.unreadable);
  const items = mediaItems(files, pages ?? []).map((item) => (known ? item : { ...item, unused: false }));
  return { items, known };
}

/** Each attachment with the pages that use it, as far as the pages given say. */
export function mediaItems(files: AttachmentFile[], pages: PageText[]): MediaItem[] {
  const users = new Map<string, PageRef[]>();
  const posters = new Map<string, string>();
  const use = (name: string, page: PageText) => {
    const list = users.get(name) ?? [];
    if (!list.some((p) => p.path === page.path)) list.push({ name: page.name, path: page.path });
    users.set(name, list);
  };
  for (const page of pages) {
    let lastVideo: string | null = null;
    for (const link of pageLinks(page.text)) {
      if (link.kind === 'poster') {
        use(link.href, page);
        // A poster follows the video it belongs to in the page's reading.
        if (link.key === 'poster' && lastVideo && !posters.has(lastVideo)) posters.set(lastVideo, link.href);
        continue;
      }
      const name = attachmentAt(page.path, link.href);
      lastVideo = link.kind === 'media' && name && mediaKind(name) === 'video' ? name : null;
      if (name) use(name, page);
    }
  }
  // A page that names a file anywhere uses it, in whatever form.
  const texts = pages.map((page) => ({ page, text: folded(page.text) }));
  for (const file of files) {
    const forms = writings(file.name);
    for (const { page, text } of texts) {
      if (forms.some((form) => text.includes(form))) use(file.name, page);
    }
  }
  return files.map((file) => {
    const usedBy = users.get(file.name) ?? [];
    return { ...file, kind: kindOf(file.name), usedBy, unused: usedBy.length === 0, poster: posters.get(file.name) ?? null };
  });
}

/** An ISO time as the day it falls on here, for the user's calendar, not UTC's. */
export function localDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso.slice(0, 10);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
}

export type MediaFilter = 'all' | 'images' | 'videos' | 'pdfs' | 'other' | 'unused';
export type MediaSort = 'name' | 'size' | 'date';

const FILTERS: Record<MediaFilter, (item: MediaItem) => boolean> = {
  all: () => true,
  images: (item) => item.kind === 'image',
  videos: (item) => item.kind === 'video',
  pdfs: (item) => item.kind === 'pdf',
  other: (item) => item.kind === 'other',
  unused: (item) => item.unused,
};

/** Text as a search compares it: no case, no accents. */
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const byName = (a: MediaItem, b: MediaItem) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });

/** The items a filter, a search and a sort show, in order. */
export function shownItems(items: MediaItem[], view: { filter: MediaFilter; search: string; sort: MediaSort }): MediaItem[] {
  const search = plain(view.search.trim());
  const shown = items.filter((item) => FILTERS[view.filter](item) && plain(item.name).includes(search));
  const order = {
    name: byName,
    size: (a: MediaItem, b: MediaItem) => b.size - a.size || byName(a, b),
    date: (a: MediaItem, b: MediaItem) => b.modified.localeCompare(a.modified) || byName(a, b),
  }[view.sort];
  return [...shown].sort(order);
}
