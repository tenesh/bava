/**
 * Links between pages: which page a link reaches, and the address one page
 * uses for another. The cases in testdata/links/paths.json pin the rules.
 */

/** A page or folder that moved, relative to the Space. */
export type Move = { from: string; to: string };

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/** `path.Join`'s cleaning: `.` and `..` resolved, `..` kept where it leaves the top. */
function cleanPath(p: string): string {
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' && out.length > 0 && out[out.length - 1] !== '..') out.pop();
    else out.push(part);
  }
  return out.join('/') || '.';
}

function dirOf(p: string): string {
  const at = p.lastIndexOf('/');
  return at < 0 ? '' : p.slice(0, at);
}

function baseOf(p: string): string {
  return p.slice(p.lastIndexOf('/') + 1);
}

/** Go's url.PathUnescape: null for a broken escape. */
function unescapePath(p: string): string | null {
  if (/%(?![0-9A-Fa-f]{2})/.test(p)) return null;
  try {
    return decodeURIComponent(p.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
  } catch {
    return null;
  }
}

/**
 * The file a link reaches from a page, relative to the Space, and what
 * follows it (`?query` or `#anchor`). Null for an address that is only an anchor, carries a scheme,
 * starts at a root, cannot be decoded, or leaves the Space.
 */
export function resolveLink(page: string, dest: string): { target: string; anchor: string } | null {
  if (dest === '' || dest[0] === '#' || dest[0] === '/' || SCHEME.test(dest)) return null;
  // A query or an anchor stays as written, after the path.
  const at = dest.search(/[?#]/);
  const p = at < 0 ? dest : dest.slice(0, at);
  const anchor = at < 0 ? '' : dest.slice(at);
  const decoded = unescapePath(p);
  if (!decoded) return null;
  const dir = dirOf(page);
  const target = cleanPath(dir ? `${dir}/${decoded}` : decoded);
  if (target === '.' || target === '..' || target.startsWith('../')) return null;
  return { target, anchor };
}

const ENCODED = new Set([...' %()<>?#"\\|']);

/** Percent-encodes what an address cannot hold as written, and nothing else. */
function encodeSegment(s: string): string {
  let out = '';
  for (const c of s) {
    const code = c.charCodeAt(0);
    out += code < 0x20 || code === 0x7f || ENCODED.has(c) ? `%${code.toString(16).toUpperCase().padStart(2, '0')}` : c;
  }
  return out;
}

/** The address a page uses to reach a file: relative to the page's folder, encoded. */
export function linkTo(from: string, target: string, anchor: string): string {
  const fromParts = dirOf(from) ? dirOf(from).split('/') : [];
  const toParts = target.split('/');
  let common = 0;
  while (common < fromParts.length && common < toParts.length - 1 && fromParts[common] === toParts[common]) common += 1;
  const up = '../'.repeat(fromParts.length - common);
  return up + toParts.slice(common).map(encodeSegment).join('/') + anchor;
}

/** Where a path is after the moves. */
export function movedTo(p: string, moves: Move[]): string {
  for (const m of moves) {
    if (p === m.from) return m.to;
    if (p.startsWith(m.from + '/')) return m.to + p.slice(m.from.length);
  }
  return p;
}

/** Where a path was before the moves. */
export function movedFrom(p: string, moves: Move[]): string {
  for (const m of moves) {
    if (p === m.to) return m.from;
    if (p.startsWith(m.to + '/')) return m.from + p.slice(m.to.length);
  }
  return p;
}

/** A file's name as a link's text starts: without `.md`. */
export function linkName(p: string): string {
  const base = baseOf(p);
  return /\.md$/i.test(base) ? base.slice(0, -3) : base;
}

/**
 * A link's address and text after the moves, read from the page at its path
 * before them; the text follows only where it is still the old name. Null
 * when the link reaches the same file as it did.
 */
export function retarget(page: string, href: string, text: string, moves: Move[]): { href: string; text: string } | null {
  const reached = resolveLink(page, href);
  if (!reached) return null;
  const nextPage = movedTo(page, moves);
  const nextTarget = movedTo(reached.target, moves);
  if (resolveLink(nextPage, href)?.target === nextTarget) return null;
  const nextText = baseOf(reached.target) !== baseOf(nextTarget) && text === linkName(reached.target) ? linkName(nextTarget) : text;
  return { href: linkTo(nextPage, nextTarget, reached.anchor), text: nextText };
}

export type LinkKind = 'anchor' | 'web' | 'mail' | 'relative' | 'other';

/** What a link's address is: a heading on this page, the web, mail, a file beside it, or something Bava does not open. */
export function classifyLink(href: string): LinkKind {
  if (href.startsWith('#')) return 'anchor';
  if (/^https?:/i.test(href)) return 'web';
  if (/^mailto:/i.test(href)) return 'mail';
  if (SCHEME.test(href) || href.startsWith('/') || href === '') return 'other';
  return 'relative';
}

/** The page a link reaches when that page is not in the Space; null for any other link. */
export function missingTarget(here: string, href: string, pages: Set<string>): string | null {
  const reached = resolveLink(here, href);
  if (!reached || !/\.md$/i.test(reached.target)) return null;
  return pages.has(reached.target) ? null : reached.target;
}

/** The one page in the Space named as a missing page is; null when none is, or several are. */
export function relinkCandidate<P extends { path: string }>(target: string, pages: P[]): P | null {
  const name = baseOf(target);
  const matches = pages.filter((page) => page.path !== target && baseOf(page.path) === name);
  return matches.length === 1 ? matches[0] : null;
}

let copied: { text: string; path: string; anchor: string; name: string } | null = null;

/**
 * A link to a heading, for the clipboard: from the Space's top, so it works
 * pasted anywhere in the Space and on GitHub. Remembered, so a paste into
 * another page of this Space is made relative to that page.
 */
export function copyHeadingLink(path: string, anchor: string, name: string): string {
  const text = `[${linkLabel(name)}](${linkTo('', path, anchor)})`;
  copied = { text, path, anchor, name };
  return text;
}

/** The heading link last copied, when `text` is it. */
export function pastedHeadingLink(text: string): { path: string; anchor: string; name: string } | null {
  return copied && text === copied.text ? copied : null;
}

export type FollowAction =
  | { kind: 'anchor'; anchor: string }
  | { kind: 'external'; url: string }
  | { kind: 'page'; path: string; anchor: string }
  | { kind: 'file'; path: string };

/**
 * What following a link from a page does: show a heading on it, hand a web
 * or mail address to the system, open a page, or show a file. `here` is the
 * page's path from the Space's folder, or from its own folder outside a
 * Space. Null for an address Bava does not open.
 */
export function followAction(here: string, href: string): FollowAction | null {
  const kind = classifyLink(href);
  if (kind === 'anchor') return { kind, anchor: href };
  if (kind === 'web' || kind === 'mail') return { kind: 'external', url: href };
  if (kind !== 'relative') return null;
  const reached = resolveLink(here, href);
  if (!reached) return null;
  return /\.md$/i.test(reached.target) ? { kind: 'page', path: reached.target, anchor: reached.anchor } : { kind: 'file', path: reached.target };
}

/**
 * What following a link does from a page opened on its own, outside a
 * Space: the same as `followAction`, with the path kept relative to the
 * page's folder, which it may leave (`../`).
 */
export function followBeside(href: string): FollowAction | null {
  const kind = classifyLink(href);
  if (kind !== 'relative') return followAction('', href);
  const at = href.search(/[?#]/);
  const path = unescapePath(at < 0 ? href : href.slice(0, at));
  if (!path) return null;
  const anchor = at < 0 ? '' : href.slice(at);
  return /\.md$/i.test(path) ? { kind: 'page', path, anchor } : { kind: 'file', path };
}

/** A path relative to a folder, joined to it, with `.` and `..` resolved, in the folder's own separators. */
export function joinFile(folder: string, relative: string): string {
  const sep = folder.includes('\\') && !folder.includes('/') ? '\\' : '/';
  const parts = folder.split(sep);
  for (const part of relative.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (parts.length > 1) parts.pop();
    } else parts.push(part);
  }
  return parts.join(sep);
}

/** A link's words as Markdown text: brackets and backslashes escaped. */
export function linkLabel(text: string): string {
  return text.replace(/[\\[\]]/g, (c) => `\\${c}`);
}
