/**
 * Links in pages that are not open: what a rename rewrites, and what
 * "Linked from" counts. Read with the Document's own reader (`pageLinks`),
 * so a link here is exactly a link in the Document, and rewritten in place:
 * only an address, and its words where they are still the old name, change.
 */
import type { Node } from 'prosemirror-model';
import { addressOf, markFileKey, markFileOf, markPageKey, markPageOf, pageLinks, parsePage, wordsOf, type MarkFileKey, type PageLink } from './markdown';
import { movedFrom, movedTo, resolveLink, retarget, type Move } from './links';

const ATTACHMENTS = '.bava/attachments/';

/** A poster's file name after the moves; null when it did not move, or left the attachments folder. */
export function posterAfter(name: string, moves: Move[]): string | null {
  const next = movedTo(ATTACHMENTS + name, moves);
  if (next === ATTACHMENTS + name || !next.startsWith(ATTACHMENTS) || next.slice(ATTACHMENTS.length).includes('/')) return null;
  return next.slice(ATTACHMENTS.length);
}

/** A page's text after a rename, and how many of its links to what moved could not be placed (left as they were). */
export type Rewritten = { text: string; unplaced: number };

const escapeAttr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// As the table writer escapes a cell's text: `$` and `[` would read back as
// an equation or a footnote.
const escapeCell = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\$/g, '&#36;').replace(/\[/g, '&#91;');

/** A page's name as a link's words in Markdown, escaped as the Document's writer escapes text. */
function escapeWords(text: string, cell: boolean): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const rest = text.slice(i);
    if ('\\*_[]`~$'.includes(c) || (c === '|' && cell) || (c === '<' && /^<[A-Za-z/!?]/.test(rest)) || (c === '&' && /^&(#\d+|#[xX][\da-fA-F]+|[A-Za-z][A-Za-z\d]*);/.test(rest))) out += '\\';
    out += c;
  }
  return out;
}

/**
 * A page's text with its links following the moves, read from the page at
 * its path before them; null when no link reaches anything that moved.
 */
export function rewritePageLinks(page: string, text: string, moves: Move[]): Rewritten | null {
  const edits = new Map<number, { end: number; with: string }>();
  let unplaced = 0;
  let any = false;
  for (const link of pageLinks(text)) {
    if (link.kind === 'poster') {
      const name = posterAfter(link.href, moves);
      if (name === null) continue;
      any = true;
      const key = link.key ?? 'poster';
      if (!link.dest || markFileOf(text.slice(link.dest[0], link.dest[1]), key) !== link.href) unplaced += 1;
      else edits.set(link.dest[0], { end: link.dest[1], with: markFileKey(key, name, text.startsWith(`${key}="`, link.dest[0])) });
      continue;
    }
    if (link.kind === 'embed') {
      const next = retarget(page, link.href, '￼', moves);
      if (!next) continue;
      any = true;
      if (!link.dest || markPageOf(text.slice(link.dest[0], link.dest[1])) !== link.href) unplaced += 1;
      else edits.set(link.dest[0], { end: link.dest[1], with: markPageKey(next.href) });
      continue;
    }
    const next = retarget(page, link.href, link.text ?? '￼', moves);
    if (!next) continue;
    any = true;
    // Each place is written only if what is there reads as the link's own
    // address or words: a place found wrongly is never written.
    const written = link.dest ? text.slice(link.dest[0], link.dest[1]) : '';
    if (!link.dest || addressOf(written, link.html) !== link.href) {
      unplaced += 1;
      continue;
    }
    const angled = !link.html && written.startsWith('<');
    edits.set(link.dest[0], { end: link.dest[1], with: link.html ? escapeAttr(next.href) : angled ? `<${next.href}>` : next.href });
    if (link.text !== null && next.text !== link.text && link.label && wordsOf(text.slice(link.label[0], link.label[1]), link.html) === link.text) {
      edits.set(link.label[0], { end: link.label[1], with: link.html ? escapeCell(next.text) : escapeWords(next.text, link.cell) });
    }
  }
  if (!any) return null;
  const sorted = [...edits].sort((a, b) => b[0] - a[0]);
  // Edits that overlap were placed wrongly: nothing is written.
  if (sorted.some((edit, i) => i > 0 && sorted[i - 1][0] < edit[1].end)) return { text, unplaced: unplaced + 1 };
  let out = text;
  for (const [start, edit] of sorted) out = out.slice(0, start) + edit.with + out.slice(edit.end);
  // Read again as the Document reads it: anything but the links' addresses
  // and words changed means a place was wrong, and nothing is written.
  if (!onlyLinksChanged(page, text, out, moves)) return { text, unplaced: Math.max(unplaced, 1) };
  return { text: out, unplaced };
}

type Run = { kind: 'link' | 'media' | 'poster' | 'embed'; href: string; text: string; key?: MarkFileKey };

/** A page as the Document reads it, with every link's address and words left out, and its links in order. */
function reading(markdown: string): { rest: string; links: Run[] } {
  const page = parsePage(markdown);
  const links: Run[] = [];
  const blank = (node: Node): unknown => {
    const json = node.toJSON() as { text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: unknown[] };
    const link = node.marks.find((m) => m.type.name === 'link');
    if (node.isText && link) {
      links.push({ kind: 'link', href: link.attrs.href as string, text: node.text! });
      return { ...json, text: '', marks: json.marks?.map((m) => (m.type === 'link' ? { type: 'link' } : m)) };
    }
    // A media block's address, and a video's poster, may change; its words may not.
    if (node.type.name === 'image' || node.type.name === 'video') {
      links.push({ kind: 'media', href: node.attrs.src as string, text: node.attrs.alt as string });
      if (node.attrs.poster) links.push({ kind: 'poster', key: 'poster', href: node.attrs.poster as string, text: '' });
      return { ...json, attrs: { ...node.attrs, src: '', written: null, poster: node.attrs.poster ? '' : null } };
    }
    // An embed's picture may change as a media block's address, and the page
    // its frame is on as a link's address; its words may not.
    if (node.type.name === 'embed') {
      links.push({ kind: 'media', href: node.attrs.src as string, text: node.attrs.alt as string });
      if (node.attrs.page) links.push({ kind: 'embed', href: node.attrs.page as string, text: '' });
      return { ...json, attrs: { ...node.attrs, src: '', written: null, page: node.attrs.page ? '' : null } };
    }
    // A card's address and words may change as a link's; its pictures as a poster.
    if (node.type.name === 'card') {
      links.push({ kind: 'link', href: node.attrs.href as string, text: node.attrs.text as string });
      for (const key of ['icon', 'image'] as const) if (node.attrs[key]) links.push({ kind: 'poster', key, href: node.attrs[key] as string, text: '' });
      return { ...json, attrs: { ...node.attrs, href: '', text: '', written: null, icon: node.attrs.icon ? '' : null, image: node.attrs.image ? '' : null } };
    }
    // A reference definition is kept as written; its address is a link's.
    if (node.type.name === 'kept') {
      const definition = /^(\s*\[(?:[^\]\\]|\\.)*\]:)/.exec(node.attrs.text as string);
      if (definition) return { ...json, attrs: { text: definition[1] } };
    }
    const content: unknown[] = [];
    node.forEach((child) => content.push(blank(child)));
    // A line break inside a link's words carries the link too.
    const marks = json.marks?.map((m) => (m.type === 'link' ? { type: 'link' } : m));
    return { ...json, ...(marks ? { marks } : {}), ...(content.length > 0 ? { content } : {}) };
  };
  return { rest: JSON.stringify({ doc: blank(page.doc), front: page.front }), links };
}

/**
 * Whether a page's new text differs from its old only in its links'
 * addresses and words, each link going where the moves take it: read with
 * the Document's own reader, so a place found wrongly can never be written.
 */
export function onlyLinksChanged(page: string, before: string, after: string, moves: Move[]): boolean {
  const was = reading(before);
  const now = reading(after);
  if (was.rest !== now.rest || was.links.length !== now.links.length) return false;
  return was.links.every((link, i) => {
    const got = now.links[i];
    if (got.kind !== link.kind || got.key !== link.key) return false;
    if (link.kind === 'poster') return got.href === (posterAfter(link.href, moves) ?? link.href);
    if (link.kind === 'embed') return got.href === (retarget(page, link.href, '￼', moves)?.href ?? link.href);
    if (link.kind === 'media') return got.text === link.text && got.href === (retarget(page, link.href, link.text, moves)?.href ?? link.href);
    const next = retarget(page, link.href, link.text, moves);
    return got.href === (next?.href ?? link.href) && (got.text === link.text || got.text === next?.text);
  });
}

/** Whether any link the Document reads in a page reaches `target`. */
export function linksTo(page: string, text: string, target: string): boolean {
  // A poster is a file's name, and an embed shows a frame: neither is a link.
  return pageLinks(text).some((link: PageLink) => link.kind !== 'poster' && link.kind !== 'embed' && resolveLink(page, link.href)?.target === target);
}

/** A page of the Space with its text, as the file side lists it. */
export type PageText = { name: string; path: string; text: string };

/** A page to write back, only if it still reads as `before`. */
export type PageEdit = { path: string; before: string; after: string };

/**
 * What a rename or move rewrites: every page (listed where it is now) whose
 * links reach something that moved, read from where it was. The open page is
 * left to the editor, which rewrites it as an edit. `unplaced` lists the
 * pages with a link that could not be placed, and so was left as it was.
 */
export function relinkEdits(pages: PageText[], moves: Move[], open: string | null): { edits: PageEdit[]; unplaced: string[] } {
  const edits: PageEdit[] = [];
  const unplaced: string[] = [];
  for (const page of pages) {
    const before = movedFrom(page.path, moves);
    if (open !== null && (before === open || page.path === open)) continue;
    const next = rewritePageLinks(before, page.text, moves);
    if (!next) continue;
    if (next.unplaced > 0) unplaced.push(page.path);
    if (next.text !== page.text) edits.push({ path: page.path, before: page.text, after: next.text });
  }
  return { edits, unplaced };
}

/** The pages whose links reach `target`, in the order listed; never `target` itself. */
export function backlinks<P extends PageText>(pages: P[], target: string): P[] {
  return pages.filter((page) => page.path !== target && linksTo(page.path, page.text, target));
}
