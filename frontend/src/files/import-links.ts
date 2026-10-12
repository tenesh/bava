/**
 * An imported page's addresses, made to work where it landed.
 *
 * Go copies an import byte for byte and says where each page and file went;
 * this rewrites, in each imported page, only the addresses that must change:
 * a picture, video or file that came in (now in `.bava/attachments`, maybe
 * under a numbered name), a picture from outside the import (copied in
 * first), and a page of the same import (which may have been numbered). A
 * link to anything else stays as written. Links are read with `pageLinks`,
 * the page's own reader, as moves are.
 */
import { addressOf, markFileKey, markFileOf, markPageKey, markPageOf, mediaKind, pageLinks } from '../docs/markdown';
import { linkTo } from '../docs/links';

/** What an import brought, as `SpaceService.Import` answers it. */
export type ImportBrought = {
  origins: { path: string; root: string }[];
  pages: { path: string; origin: number; from: string }[];
  /** `"<origin>:<from>"` to the attachment each file became. */
  attached: Record<string, string>;
};

const ATTACHMENTS = '.bava/attachments';
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/**
 * A path with `.` and `..` resolved under its root: `/`, a drive (`C:`), a
 * network share (`//server/share`) or a zip (`zip:0`). Null for a relative
 * path, or when `..` would climb above the root.
 */
function cleanPlace(p: string): string | null {
  const root = /^(?:[A-Za-z]:|zip:\d+|\/\/[^/]+\/[^/]+)(?=\/|$)/.exec(p)?.[0] ?? (p.startsWith('/') ? '' : null);
  if (root === null) return null;
  const out: string[] = [];
  for (const part of p.slice(root.length).split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(part);
  }
  return `${root}/${out.join('/')}`;
}

/**
 * Where something an import read was before it came in: a file on disk
 * (`/d/home/docs/Notes/a.png`), or an entry of the zip picked as `origin`
 * (`zip:0/Notes/a.png`).
 */
function placeOf(origins: ImportBrought['origins'], origin: number, rel: string): string | null {
  const root = origins[origin]?.root ?? '';
  return cleanPlace(root ? `${root.replace(/\\/g, '/')}/${rel}` : `zip:${origin}/${rel}`);
}

/** An address decoded as a path, as the Document decodes it; null when it cannot be. */
function decoded(p: string): string | null {
  if (/%(?![0-9A-Fa-f]{2})/.test(p)) return null;
  try {
    return decodeURIComponent(p);
  } catch {
    return null;
  }
}

/** Where an address in a page that came from `here` led before the import, and what follows its path. */
function leadsTo(here: string, href: string): { place: string; anchor: string } | null {
  if (href === '' || href[0] === '#' || href[0] === '/' || SCHEME.test(href)) return null;
  const at = href.search(/[?#]/);
  const path = decoded(at < 0 ? href : href.slice(0, at));
  // A backslash is a folder to some systems and part of a name to others: never followed.
  if (path === null || path.includes('\\')) return null;
  const place = cleanPlace(`${here.slice(0, here.lastIndexOf('/'))}/${path}`);
  return place ? { place, anchor: at < 0 ? '' : href.slice(at) } : null;
}

/**
 * Whether a place outside the import may be copied in for a picture: a file
 * on disk of a picture or video type, never one inside a hidden folder.
 */
function outsideMedia(place: string): boolean {
  return !place.startsWith('zip:') && mediaKind(place) !== null && !place.split('/').some((part) => part.startsWith('.'));
}

const escapeAttr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * The imported page's text with its addresses rewritten, or null when none
 * has to change. `attach` copies a file from outside the import into the
 * attachments and gives its name, or null when Bava cannot reach it (inside
 * a store's sandbox): that address then stays as written.
 */
export async function importedText(
  page: ImportBrought['pages'][number],
  text: string,
  brought: ImportBrought,
  attach: (path: string) => Promise<string | null>,
): Promise<string | null> {
  const here = placeOf(brought.origins, page.origin, page.from);
  if (!here) return null;
  const pagesAt = new Map<string, string>();
  for (const p of brought.pages) {
    const place = placeOf(brought.origins, p.origin, p.from);
    if (place) pagesAt.set(place, p.path);
  }
  const filesAt = new Map<string, string>();
  // A mark names its picture by name in the attachments of the Space the
  // page came from: what each of those names became, for this page's pick.
  const byName = new Map<string, string>();
  for (const [key, name] of Object.entries(brought.attached)) {
    const at = key.indexOf(':');
    const origin = Number(key.slice(0, at));
    const from = key.slice(at + 1);
    const place = placeOf(brought.origins, origin, from);
    if (place) filesAt.set(place, name);
    const marked = from.lastIndexOf(`${ATTACHMENTS}/`);
    if (origin === page.origin && marked >= 0) byName.set(from.slice(marked + ATTACHMENTS.length + 1), name);
  }

  const edits = new Map<number, { end: number; with: string }>();
  for (const link of pageLinks(text)) {
    if (!link.dest) continue;
    const written = text.slice(link.dest[0], link.dest[1]);
    if (link.kind === 'poster') {
      const key = link.key ?? 'poster';
      const name = byName.get(link.href);
      if (!name || name === link.href || markFileOf(written, key) !== link.href) continue;
      edits.set(link.dest[0], { end: link.dest[1], with: markFileKey(key, name, text.startsWith(`${key}="`, link.dest[0])) });
      continue;
    }
    // Each place is written only if what is there reads as the link's own
    // address: a place found wrongly is never written.
    if ((link.kind === 'embed' ? markPageOf(written) : addressOf(written, link.html)) !== link.href) continue;
    const target = leadsTo(here, link.href);
    if (!target) continue;
    let to: string | null = null;
    const pageTo = pagesAt.get(target.place);
    const fileTo = filesAt.get(target.place);
    if (pageTo) to = linkTo(page.path, pageTo, target.anchor);
    else if (fileTo) to = linkTo(page.path, `${ATTACHMENTS}/${fileTo}`, target.anchor);
    else if (link.kind === 'media' && outsideMedia(target.place)) {
      const got = await attach(target.place);
      if (got) to = linkTo(page.path, `${ATTACHMENTS}/${got}`, target.anchor);
    }
    if (to === null || to === link.href) continue;
    const angled = !link.html && written.startsWith('<');
    edits.set(link.dest[0], { end: link.dest[1], with: link.kind === 'embed' ? markPageKey(to) : link.html ? escapeAttr(to) : angled ? `<${to}>` : to });
  }
  if (edits.size === 0) return null;
  const sorted = [...edits].sort((a, b) => b[0] - a[0]);
  // Edits that overlap were placed wrongly: the page stays as it came.
  if (sorted.some((edit, i) => i > 0 && sorted[i - 1][0] < edit[1].end)) return null;
  let out = text;
  for (const [start, edit] of sorted) out = out.slice(0, start) + edit.with + out.slice(edit.end);
  return out === text ? null : out;
}
