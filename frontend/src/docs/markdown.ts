/**
 * A page's prose, from Markdown to a document and back, in the one style of
 * docs/file-format.md ("The document"). Reading keeps everything: what the
 * editor cannot edit is sliced from the source and written back unchanged.
 */
import { decodeHTML } from 'entities';
import MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { MarkdownParser, MarkdownSerializer, defaultMarkdownSerializer, type MarkdownSerializerState } from 'prosemirror-markdown';
import { Fragment, type Mark, type Node } from 'prosemirror-model';
import { schema } from './schema';
import { dateTag, isDay } from './dates';
import { headingEntries, type HeadingEntry } from './contents';
import { anchorPlaces, cellHtml, closingDollar, readHtmlTable, rowCells, type Piece } from './table-format';
import { EditorState } from 'prosemirror-state';
import { fixTables, TableMap } from 'prosemirror-tables';

// ---- front matter -----------------------------------------------------------

export type PageSettings = { locked?: boolean; width?: string };

/**
 * The page's front matter: its lines other than Bava's, kept byte for byte,
 * with the place Bava's `bava:` block sat (`null` when there was none), and
 * the lines under `bava:` as written.
 */
export type FrontMatter = {
  lines: string[] | null;
  bavaAt: number | null;
  bavaLines: string[];
  settings: PageSettings;
};

/**
 * Splits off front matter: a first line of `---`, a next line with something
 * on it (a page may open with a divider and an empty line), and a closing
 * line of `---` alone.
 */
function splitFront(markdown: string): { inner: string[]; rest: string } | null {
  const lines = markdown.split('\n');
  if (lines[0].replace(/\r$/, '') !== '---' || lines.length < 2 || lines[1].trim() === '') return null;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].replace(/\r$/, '').trimEnd() === '---') {
      return { inner: lines.slice(1, i).map((line) => line.replace(/\r$/, '')), rest: lines.slice(i + 1).join('\n') };
    }
  }
  return null;
}

const KNOWN = /^\s+(locked|width):\s*(.*?)\s*$/;

function readFront(markdown: string): { front: FrontMatter; body: string } {
  const empty: FrontMatter = { lines: null, bavaAt: null, bavaLines: [], settings: {} };
  const split = splitFront(markdown);
  if (!split) return { front: empty, body: markdown };
  const all = split.inner;
  const lines: string[] = [];
  const settings: PageSettings = {};
  const bavaLines: string[] = [];
  let bavaAt: number | null = null;
  for (let i = 0; i < all.length; i += 1) {
    if (/^bava:\s*$/.test(all[i])) {
      bavaAt = lines.length;
      for (i += 1; i < all.length && /^\s+\S/.test(all[i]); i += 1) {
        const pair = KNOWN.exec(all[i]);
        if (pair?.[1] === 'locked' && (pair[2] === 'true' || pair[2] === 'false')) settings.locked = pair[2] === 'true';
        else if (pair?.[1] === 'width' && /^(narrow|wide|full)$/.test(pair[2])) settings.width = pair[2];
        bavaLines.push(all[i]);
      }
      i -= 1;
      continue;
    }
    lines.push(all[i]);
  }
  return { front: { lines, bavaAt, bavaLines, settings }, body: split.rest };
}

/** The lines under `bava:`: each known key rewritten where it stood, the rest as written. */
function bavaBlock(front: FrontMatter): string[] {
  const values: Record<string, string | undefined> = {
    locked: front.settings.locked === undefined ? undefined : String(front.settings.locked),
    width: front.settings.width,
  };
  const out: string[] = [];
  const written = new Set<string>();
  for (const line of front.bavaLines) {
    const pair = KNOWN.exec(line);
    const key = pair?.[1];
    const known = key === 'locked' ? /^(true|false)$/.test(pair![2]) : key === 'width' ? /^(narrow|wide|full)$/.test(pair![2]) : false;
    if (!key || !known) {
      out.push(line);
      continue;
    }
    if (values[key] !== undefined && !written.has(key)) out.push(line.replace(/:.*$/, `: ${values[key]}`));
    written.add(key);
  }
  // A new setting; an unlocked page needs no line saying so.
  if (!written.has('locked') && front.settings.locked) out.push('  locked: true');
  if (!written.has('width') && front.settings.width) out.push(`  width: ${front.settings.width}`);
  return out;
}

function writeFront(front: FrontMatter): string {
  const bava = bavaBlock(front);
  const lines = [...(front.lines ?? [])];
  if (bava.length > 0) lines.splice(front.bavaAt ?? lines.length, 0, 'bava:', ...bava);
  // A header written with nothing in it stays; one that held only Bava's settings goes with them.
  const keptEmpty = front.lines !== null && front.lines.length === 0 && front.bavaAt === null;
  if (lines.length === 0) return keptEmpty ? '---\n---\n' : '';
  return `---\n${lines.join('\n')}\n---\n`;
}

// ---- invisible marks --------------------------------------------------------

const MARK = /^<!--\s*bava:\s*(.*?)\s*-->\s*$/;

/** One key of an invisible mark, with its text as written, to keep it when it does not apply. */
type MarkPair = { key: string; value: string | true; raw: string };

/** Inside a quoted value, what could end the comment or the quotes is written as an entity. */
const decodeValue = (value: string) => value.replace(/&quot;/g, '"').replace(/&#45;/g, '-').replace(/&amp;/g, '&');
const encodeValue = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/--/g, '&#45;&#45;');

/** The keys of an invisible mark, in order; a value in quotes may hold spaces. */
function readMark(text: string): MarkPair[] {
  const out: MarkPair[] = [];
  for (const match of text.matchAll(/([^\s="]+)(?:=("[^"]*"|\S*))?/g)) {
    const value = match[2] === undefined ? true : match[2].startsWith('"') ? decodeValue(match[2].slice(1, -1)) : match[2];
    out.push({ key: match[1], value, raw: match[0] });
  }
  return out;
}

/** The keys each block takes from a mark; any other key on it is kept as written. */
const APPLIES: Record<string, string[]> = {
  paragraph_open: ['color', 'background'],
  heading_open: ['color', 'background'],
  blockquote_open: ['color', 'background'],
  callout_open: ['color', 'background', 'icon'],
  bullet_list_open: ['color', 'background'],
  ordered_list_open: ['color', 'background', 'list'],
  fence: ['wrap', 'caption'],
  code_block: ['wrap', 'caption'],
  media_image: ['width', 'ratio', 'align', 'caption'],
  media_video: ['width', 'ratio', 'align', 'caption', 'poster', 'loop', 'muted'],
};

const VALID: Record<string, (value: string | true) => boolean> = {
  color: (v) => typeof v === 'string' && v !== '',
  background: (v) => typeof v === 'string' && v !== '',
  icon: (v) => typeof v === 'string' && v !== '',
  list: (v) => v === 'a' || v === 'i',
  wrap: (v) => v === true,
  caption: (v) => typeof v === 'string',
  width: (v) => v === 'small' || v === 'medium' || v === 'large' || v === 'full',
  ratio: (v) => v === '16:9' || v === '4:3' || v === '1:1',
  align: (v) => v === 'left' || v === 'right',
  // A file in the attachments folder, by its name alone.
  poster: (v) => typeof v === 'string' && v !== '' && !/[/\\]/.test(v) && !v.startsWith('.'),
  loop: (v) => v === true,
  muted: (v) => v === true,
};

/** A mark read onto the block that carries it: the keys it takes, and the rest as `extra`. */
function markAttrs(tokenType: string, pairs: MarkPair[] | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const extra: string[] = [];
  for (const pair of pairs ?? []) {
    if (APPLIES[tokenType]?.includes(pair.key) && VALID[pair.key](pair.value) && !(pair.key in out)) out[pair.key] = pair.value;
    else extra.push(pair.raw);
  }
  if (extra.length > 0) out.extra = extra.join(' ');
  return out;
}

// ---- block and inline rules -------------------------------------------------

/** A `$$` equation: `$$` alone on the lines around it, or `$$…$$` on one line. */
function mathBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const lineText = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
  const first = lineText(startLine).trimEnd();
  const single = /^\$\$(.*[^$].*)\$\$$/.exec(first);
  let last = startLine;
  let tex: string;
  if (single) {
    tex = single[1];
  } else if (first === '$$') {
    for (last = startLine + 1; last < endLine && lineText(last).trim() !== '$$'; last += 1);
    if (last >= endLine) return false;
    tex = state.getLines(startLine + 1, last, state.blkIndent, false);
  } else {
    return false;
  }
  if (silent) return true;
  const token = state.push('math_block', '', 0);
  token.content = tex;
  token.meta = { oneLine: Boolean(single) };
  token.map = [startLine, last + 1];
  state.line = last + 1;
  return true;
}

/**
 * A footnote's note, `[^label]: …`, with the indented lines after it: read as
 * blocks of their own, as markdown-it-footnote (MIT) reads them.
 */
function footnoteRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const src = state.src;
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  if (start + 4 > max || src[start] !== '[' || src[start + 1] !== '^') return false;
  let pos = start + 2;
  for (; pos < max; pos += 1) {
    if (src[pos] === ' ' || src[pos] === '\t') return false;
    if (src[pos] === ']') break;
  }
  if (pos === start + 2 || pos + 1 >= max || src[pos + 1] !== ':') return false;
  if (silent) return true;
  const label = src.slice(start + 2, pos);
  const open = state.push('footnote_open', '', 1);
  open.meta = { label };
  open.map = [startLine, 0];

  const afterColon = pos + 2;
  const oldBMark = state.bMarks[startLine];
  const oldTShift = state.tShift[startLine];
  const oldSCount = state.sCount[startLine];
  const oldParent = state.parentType;
  const initial = state.sCount[startLine] + afterColon - (state.bMarks[startLine] + state.tShift[startLine]);
  let offset = initial;
  pos = afterColon;
  while (pos < max && (src[pos] === ' ' || src[pos] === '\t')) {
    offset += src[pos] === '\t' ? 4 - (offset % 4) : 1;
    pos += 1;
  }
  state.tShift[startLine] = pos - afterColon;
  state.sCount[startLine] = offset - initial;
  state.bMarks[startLine] = afterColon;
  state.blkIndent += 4;
  state.parentType = 'footnote' as typeof state.parentType;
  if (state.sCount[startLine] < state.blkIndent) state.sCount[startLine] += state.blkIndent;
  state.md.block.tokenize(state, startLine, endLine);
  state.parentType = oldParent;
  state.blkIndent -= 4;
  state.tShift[startLine] = oldTShift;
  state.sCount[startLine] = oldSCount;
  state.bMarks[startLine] = oldBMark;

  state.push('footnote_close', '', -1);
  open.map[1] = state.line;
  return true;
}

/** A footnote reference `[^label]`, and an inline equation `$…$`. */
function inlineRule(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const at = state.pos;
  if (src.startsWith('[^', at)) {
    const end = src.indexOf(']', at + 2);
    if (end < 0 || end === at + 2 || /\s/.test(src.slice(at + 2, end))) return false;
    if (!silent) state.push('footnote_ref', '', 0).meta = { label: src.slice(at + 2, end) };
    state.pos = end + 1;
    return true;
  }
  // `$$…$$` inside a line (Obsidian's display maths) is kept as written.
  if (src.startsWith('$$', at)) {
    const end = closingDollar(src, at + 2, '$$');
    if (end < 0 || end === at + 2) return false;
    if (!silent) state.push('keptInline', '', 0).content = src.slice(at, end + 2);
    state.pos = end + 2;
    return true;
  }
  if (src[at] === '$' && src[at + 1] !== ' ' && src[at + 1] !== undefined) {
    const end = closingDollar(src, at + 1, '$');
    if (end < 0 || src[end - 1] === ' ') return false;
    if (!silent) state.push('math_inline', '', 0).content = src.slice(at + 1, end);
    state.pos = end + 1;
    return true;
  }
  return false;
}


/** Inline HTML Bava understands becomes marks, when it is closed; any other stays as it is. */
function inlineHtml(children: Token[], TokenCtor: typeof Token): Token[] {
  const opener = /^<(u|span)(\s[^>]*)?>$/i;
  const closer = /^<\/(u|span)>$/i;
  // Pair each opening tag with its close, known or not, so an unknown span
  // takes its own close and an unclosed tag stays text.
  const closes = new Map<number, number>();
  const stack: { at: number; tag: string }[] = [];
  children.forEach((child, i) => {
    if (child.type !== 'html_inline') return;
    const open = opener.exec(child.content);
    if (open) {
      stack.push({ at: i, tag: open[1].toLowerCase() });
      return;
    }
    const close = closer.exec(child.content);
    if (!close) return;
    const tag = close[1].toLowerCase();
    const at = stack.map((s) => s.tag).lastIndexOf(tag);
    if (at >= 0) closes.set(stack.splice(at)[0].at, i);
  });
  const closeKind = new Map<number, string>();
  return children.map((child, i) => {
    if (child.type !== 'html_inline') return child;
    const start = opener.exec(child.content);
    const close = closes.get(i);
    if (start && close !== undefined) {
      const attrs = start[2]?.trim() ?? '';
      const data = /^data-(color|highlight)="([a-z]+)"$/.exec(attrs);
      const kind = start[1].toLowerCase() === 'u' ? (attrs === '' ? 'underline' : null) : data ? data[1] : null;
      if (kind) {
        closeKind.set(close, kind);
        const token = new TokenCtor(`${kind}_open`, '', 1);
        if (data) token.attrSet('name', data[2]);
        return token;
      }
    }
    const kind = closeKind.get(i);
    if (kind) return new TokenCtor(`${kind}_close`, '', -1);
    const kept = new TokenCtor('keptInline', '', 0);
    kept.content = child.content;
    return kept;
  });
}

/**
 * A date chip: `<time datetime="YYYY-MM-DD">` around plain words, on a real
 * day. Words holding Markdown's marks, or none, stay as written.
 */
function dateRule(state: StateInline, silent: boolean): boolean {
  const match = /^<time datetime="(\d{4}-\d{2}-\d{2})">([^<>&\n*_`~[\]\\$]+)<\/time>/.exec(state.src.slice(state.pos));
  if (!match || !isDay(match[1])) return false;
  if (!silent) state.push('date', '', 0).meta = { date: match[1], text: match[2] };
  state.pos += match[0].length;
  return true;
}

const md = new MarkdownIt('default', { html: true, linkify: false, typographer: false });
md.block.ruler.before('fence', 'bava_math', mathBlockRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
md.block.ruler.before('reference', 'bava_footnote', footnoteRule, { alt: ['paragraph', 'reference'] });
md.inline.ruler.before('link', 'bava_inline', inlineRule);
md.inline.ruler.before('html_inline', 'bava_date', dateRule);

type BlockRule = (state: StateBlock, startLine: number, endLine: number, silent: boolean) => boolean;
type RulerInternals = { __rules__: { name: string; fn: BlockRule }[] };
type InlineRule = (state: StateInline, silent: boolean) => boolean;
type InlineRulerInternals = { __rules__: { name: string; fn: InlineRule }[] };

/**
 * An image's words as plain text, as a viewer shows them: escaped characters
 * and code as they read (markdown-it's own flattening drops escapes).
 */
function plainText(tokens: Token[]): string {
  return tokens
    .map((t) => {
      if (t.type === 'text' || t.type === 'text_special' || t.type === 'code_inline' || t.type === 'html_inline') return t.content;
      if (t.type === 'softbreak' || t.type === 'hardbreak') return '\n';
      if (t.type === 'image') return plainText(t.children ?? []);
      return '';
    })
    .join('');
}

/** What an image reads as: its address as the Document reads it, its words as plain text, its title. */
type ImageRead = { src: string; alt: string; title: string | null };

// An image is kept exactly as written, with what it reads as noted: one alone
// on its line becomes a media block (`readMedia`).
{
  const image = (md.inline.ruler as unknown as InlineRulerInternals).__rules__.find((r) => r.name === 'image')!.fn;
  md.inline.ruler.at('image', (state, silent) => {
    const start = state.pos;
    // The text before it is its own token, so what the image pushes can be replaced.
    if (!silent && state.pending) state.pushPending();
    const before = state.tokens.length;
    if (!image(state, silent)) return false;
    if (!silent) {
      const token = state.tokens[before];
      // By reference (`![x][r]`), its address is a definition's elsewhere on the page.
      const end = state.pos;
      const labelEnd = state.md.helpers.parseLinkLabel(state, start + 1, false);
      state.pos = end;
      const byReference = labelEnd < 0 || state.src[labelEnd + 1] !== '(';
      const read: ImageRead = {
        src: token.attrGet('src') ?? '',
        alt: plainText(token.children ?? []),
        title: token.attrGet('title') || null,
      };
      state.tokens.length = before;
      const kept = state.push('keptInline', '', 0);
      kept.content = state.src.slice(start, state.pos);
      const reading = (state.env as LinkEnv).bavaLinks;
      kept.meta = { image: read, byReference, ...(reading ? { bavaAt: linkPlace(state, start + 1, reading) } : {}) };
    }
    return true;
  });
}

// Where each link sits in the page's text, noted while a page is read for
// its links (`pageLinks`), so a rename changes exactly what the Document
// reads as a link.
{
  const link = (md.inline.ruler as unknown as InlineRulerInternals).__rules__.find((r) => r.name === 'link')!.fn;
  md.inline.ruler.at('link', (state, silent) => {
    const start = state.pos;
    const before = state.tokens.length;
    if (!link(state, silent)) return false;
    const reading = (state.env as LinkEnv).bavaLinks;
    if (!silent && reading) {
      const open = state.tokens.slice(before).find((t) => t.type === 'link_open');
      if (open) open.meta = { ...open.meta, bavaAt: linkPlace(state, start, reading) };
    }
    return true;
  });
  md.core.ruler.at('inline', (state) => {
    const reading = (state.env as LinkEnv).bavaLinks;
    // A pipe table's cells carry no line of their own: their row's.
    let row: [number, number] | null = null;
    let cellIndex = -1;
    state.tokens.forEach((token, i) => {
      if (token.type === 'tr_open') {
        row = token.map;
        cellIndex = -1;
      }
      if (token.type !== 'inline') return;
      if (reading) {
        reading.cell = !state.inlineMode && /^t[hd]_open$/.test(state.tokens[i - 1]?.type ?? '');
        if (reading.cell) cellIndex += 1;
        reading.cellIndex = cellIndex;
        const map = state.inlineMode ? reading.calloutMap : reading.cell ? row : token.map;
        reading.bases = map ? lineBases(reading, token.content, map, reading.cell) : null;
      }
      state.md.inline.parse(token.content, state.md, state.env, token.children ?? []);
    });
  });
}

// A link reference definition stays where it was written, used or not.
{
  const reference = (md.block.ruler as unknown as RulerInternals).__rules__.find((r) => r.name === 'reference')!.fn;
  // `at` would reset what the rule can interrupt; it keeps markdown-it's own.
  md.block.ruler.at('reference', (state, startLine, endLine, silent) => {
    if (!reference(state, startLine, endLine, silent)) return false;
    if (!silent) noteDefinition(state, startLine);
    if (!silent) {
      const token = state.push('kept', '', 0);
      token.map = [startLine, state.line];
      token.meta = { keptText: state.getLines(startLine, state.line, state.blkIndent, false).replace(/\s+$/, '') };
    }
    return true;
  });
}

/**
 * A kept block's text as it sits in its container: inside a list item or a
 * quote, without the container's indent or `>` markers, which the writer puts
 * back. Taken from the file's own lines, so it is exactly what was written.
 */
for (const name of ['html_block', 'table']) {
  const rule = (md.block.ruler as unknown as RulerInternals & { __rules__: { alt: string[] }[] }).__rules__.find((r) => r.name === name)!;
  const original = rule.fn;
  // `at` resets what a rule can interrupt, so a table or HTML block straight
  // after a paragraph would be read as that paragraph's text: keep its own.
  const alt = [...(rule as unknown as { alt: string[] }).alt];
  md.block.ruler.at(name, (state, startLine, endLine, silent) => {
    const before = state.tokens.length;
    if (!original(state, startLine, endLine, silent)) return false;
    if (!silent && state.tokens.length > before) {
      const token = state.tokens[before];
      const keptText = state.getLines(startLine, state.line, state.blkIndent, false).replace(/\s+$/, '');
      token.meta = { ...token.meta, keptText };
      // A row longer than the header loses its extra cells in every reader:
      // such a table is kept as written, never read and rewritten.
      if (name === 'table') {
        const lines = keptText.split('\n');
        const width = rowCells(lines[0]);
        if (lines.slice(2).some((line) => rowCells(line) > width)) token.meta.keep = true;
      }
    }
    return true;
  }, { alt });
}

// ---- reading the structure ---------------------------------------------------

type CoreState = { tokens: Token[]; Token: typeof Token; md: MarkdownIt; env: unknown };

const CELL_MARKS: Record<string, string> = { strong: 'strong', em: 'em', underline: 'underline', s: 's', link: 'link', color: 'color', highlight: 'highlight' };

/** An HTML cell's pieces as inline tokens, the way markdown-it would give them. */
function pieceTokens(pieces: Piece[], TokenCtor: typeof Token): Token[] {
  return pieces.map((piece) => {
    if (piece.kind === 'text') {
      const token = new TokenCtor('text', '', 0);
      token.content = piece.text;
      return token;
    }
    if (piece.kind === 'code') {
      const token = new TokenCtor('code_inline', 'code', 0);
      token.content = piece.text;
      return token;
    }
    if (piece.kind === 'br') return new TokenCtor('hardbreak', 'br', 0);
    if (piece.kind === 'math') {
      const token = new TokenCtor('math_inline', '', 0);
      token.content = piece.tex;
      return token;
    }
    if (piece.kind === 'footnote') {
      const token = new TokenCtor('footnote_ref', '', 0);
      token.meta = { label: piece.label };
      return token;
    }
    if (piece.kind === 'date') {
      const token = new TokenCtor('date', '', 0);
      token.meta = { date: piece.date, text: piece.text };
      return token;
    }
    if (piece.kind === 'kept') {
      const token = new TokenCtor('keptInline', '', 0);
      token.content = piece.text;
      return token;
    }
    const name = CELL_MARKS[piece.mark];
    const token = new TokenCtor(`${name}_${piece.kind}`, '', piece.kind === 'open' ? 1 : -1);
    if (piece.kind === 'open') for (const [key, value] of Object.entries(piece.attrs ?? {})) token.attrSet(key, value);
    return token;
  });
}

/** A cell: its open token, a paragraph of its inline content, and its close. */
function cellTokens(state: CoreState, header: boolean, attrs: Record<string, unknown>, children: Token[]): Token[] {
  const kind = header ? 'table_header' : 'table_cell';
  const open = new state.Token(`${kind}_open`, '', 1);
  open.meta = { cell: attrs };
  const inline = new state.Token('inline', '', 0);
  inline.children = children;
  inline.content = '';
  return [open, new state.Token('paragraph_open', 'p', 1), inline, new state.Token('paragraph_close', 'p', -1), new state.Token(`${kind}_close`, '', -1)];
}

/** Markdown tables and Bava's HTML tables become table tokens; any other table stays as it is. */
function readTables(state: CoreState): void {
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === 'html_block' && /^<table[\s>]/i.test(token.content.trim())) {
      const table = readHtmlTable(token.content);
      if (table) {
        const first = out.length;
        out.push(new state.Token('table_open', 'table', 1));
        for (const row of table.rows) {
          out.push(new state.Token('table_row_open', 'tr', 1));
          for (const cell of row) {
            const widths = table.widths.slice(cell.column, cell.column + cell.colspan);
            const colwidth = widths.length === cell.colspan && widths.some((w) => w !== null) ? widths.map((w) => w ?? 0) : null;
            const attrs = { colspan: cell.colspan, rowspan: cell.rowspan, align: cell.align, background: cell.background, colwidth };
            out.push(...cellTokens(state, cell.header, attrs, pieceTokens(cell.pieces, state.Token)));
          }
          out.push(new state.Token('table_row_close', 'tr', -1));
        }
        out.push(new state.Token('table_close', 'table', -1));
        noteTableLinks(state, token, out.slice(first));
        continue;
      }
    }
    if (token.type === 'table_open' && !token.meta?.keep) {
      const end = tokens.findIndex((t, j) => j > i && t.type === 'table_close' && t.level === token.level);
      out.push(new state.Token('table_open', 'table', 1));
      for (let j = i + 1; j < end; j += 1) {
        const part = tokens[j];
        if (part.type === 'tr_open') out.push(new state.Token('table_row_open', 'tr', 1));
        else if (part.type === 'tr_close') out.push(new state.Token('table_row_close', 'tr', -1));
        else if (part.type === 'th_open' || part.type === 'td_open') {
          const align = /text-align:\s*(left|center|right)/.exec(part.attrGet('style') ?? '')?.[1] ?? null;
          // A line break in a cell is `<br>`: here it is a break, not kept HTML.
          const children = (tokens[j + 1].children ?? []).map((child) =>
            child.type === 'html_inline' && /^<br\s*\/?>$/i.test(child.content) ? new state.Token('hardbreak', 'br', 0) : child,
          );
          out.push(...cellTokens(state, part.type === 'th_open', { align }, children));
          j += 2;
        }
      }
      out.push(new state.Token('table_close', 'table', -1));
      i = end;
      continue;
    }
    out.push(token);
  }
  state.tokens = out;
}

const DETAILS = /^<details(\s+open)?>\s*<summary>([^<\n]*)<\/summary>$/;

/** `<details>` and its summary, up to the `</details>` at its level, become a toggle. */
function readToggles(state: CoreState): void {
  const tokens = state.tokens;
  const out: Token[] = [];
  const open: { level: number; at: number }[] = [];
  const closes = new Set<number>();
  // Pair first, so a `<details>` never closed stays as written.
  const pairs = new Map<number, number>();
  tokens.forEach((token, i) => {
    if (token.type !== 'html_block') return;
    const text = token.content.trim();
    if (DETAILS.test(text)) open.push({ level: token.level, at: i });
    else if (text === '</details>') {
      const match = open.map((o) => o.level).lastIndexOf(token.level);
      if (match >= 0) {
        pairs.set(open.splice(match)[0].at, i);
        closes.add(i);
      }
    }
  });
  tokens.forEach((token, i) => {
    if (pairs.has(i)) {
      const [, isOpen, summary] = DETAILS.exec(token.content.trim())!;
      const toggle = new state.Token('toggle_open', 'details', 1);
      toggle.meta = { open: Boolean(isOpen) };
      const text = new state.Token('text', '', 0);
      // Raw HTML: entities decode, backslashes stay.
      text.content = decodeHTML(summary);
      const inline = new state.Token('inline', '', 0);
      inline.children = [text];
      inline.content = text.content;
      out.push(toggle, new state.Token('toggle_summary_open', '', 1), inline, new state.Token('toggle_summary_close', '', -1));
    } else if (closes.has(i)) {
      out.push(new state.Token('toggle_close', 'details', -1));
    } else {
      out.push(token);
    }
  });
  state.tokens = out;
}

/** The contents block: its two marks and whatever list lies between, which is rebuilt. */
function readContents(state: CoreState): void {
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const mark = token.type === 'html_block' ? MARK.exec(token.content.trim()) : null;
    if (mark?.[1] === 'contents') {
      const end = tokens.findIndex((t, j) => j > i && t.type === 'html_block' && t.level === token.level && MARK.exec(t.content.trim())?.[1] === '/contents');
      // Only a list, or nothing, is Bava's to rebuild; anything else between
      // the marks stays as it is, and the marks with it.
      const between = end > 0 ? tokens.slice(i + 1, end) : [];
      const onlyAList =
        between.length === 0 ||
        (between[0].type === 'bullet_list_open' && between.at(-1)!.type === 'bullet_list_close' && between.filter((t) => t.type === 'bullet_list_open' && t.level === between[0].level).length === 1);
      if (end > 0 && onlyAList) {
        const contents = new state.Token('contents', '', 0);
        contents.level = token.level;
        out.push(contents);
        i = end;
        continue;
      }
    }
    out.push(token);
  }
  state.tokens = out;
}

const CALLOUT = /^\[!([A-Za-z][\w-]*)\]([+-]?)([ \t]+[^\n]*)?$/;

/** A quote whose first line is `[!kind]` is a callout; that line is its kind, fold and title. */
function readCallouts(state: CoreState): void {
  const tokens = state.tokens;
  const drop = new Set<number>();
  tokens.forEach((token, i) => {
    if (token.type !== 'blockquote_open' || tokens[i + 1]?.type !== 'paragraph_open' || tokens[i + 2]?.type !== 'inline') return;
    const inline = tokens[i + 2];
    const firstLine = inline.content.split('\n')[0];
    const marker = CALLOUT.exec(firstLine);
    if (!marker) return;
    const close = tokens.findIndex((t, j) => j > i && t.type === 'blockquote_close' && t.level === token.level);
    if (close < 0) return;
    token.type = 'callout_open';
    token.meta = { ...token.meta, callout: { kind: marker[1], fold: marker[2], title: marker[3] ?? null } };
    tokens[close].type = 'callout_close';
    // The first line is the marker and its title, kept as written; the rest
    // is read again on its own, so nothing that ran across the line is cut.
    const rest = inline.content.includes('\n') ? inline.content.slice(inline.content.indexOf('\n') + 1) : '';
    if (rest.trim() === '') {
      drop.add(i + 1).add(i + 2).add(i + 3);
    } else {
      inline.content = rest;
      // The rest starts on the marker's next line.
      const reading = (state.env as LinkEnv).bavaLinks;
      if (reading) reading.calloutMap = inline.map ? [inline.map[0] + 1, inline.map[1]] : null;
      inline.children = state.md.parseInline(rest, state.env)[0].children ?? [];
      if (reading) reading.calloutMap = null;
    }
  });
  state.tokens = tokens.filter((_, i) => !drop.has(i));
}

const MEDIA: Record<string, 'image' | 'video'> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
  mp4: 'video', webm: 'video', mov: 'video',
};

/** Whether an address is an image or a video file, by its type; null for any other. */
export function mediaKind(src: string): 'image' | 'video' | null {
  const path = src.replace(/[?#].*$/, '');
  const dot = path.lastIndexOf('.');
  if (dot < 0 || dot < path.lastIndexOf('/')) return null;
  return MEDIA[path.slice(dot + 1).toLowerCase()] ?? null;
}

/**
 * A paragraph holding one image of an image or video type, at a relative
 * address or on the web, and nothing else, is a media block. The line opening a list item stays text: the item needs it.
 */
function readMedia(state: CoreState): void {
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const children = tokens[i + 1]?.children;
    const only = token.type === 'paragraph_open' && tokens[i - 1]?.type !== 'list_item_open' && children?.length === 1 ? children[0] : null;
    // An image by reference stays as written: its line alone does not say where it is.
    const read = only?.type === 'keptInline' && !only.meta?.byReference ? (only.meta?.image as ImageRead | undefined) : undefined;
    // Relative to the page, or on the web; one from the disk's root or by any
    // other scheme is kept as written.
    const local = read !== undefined && !/^([A-Za-z][A-Za-z0-9+.-]*:|[/\\])/.test(read.src);
    const web = read !== undefined && /^https?:\/\//i.test(read.src);
    const kind = local || web ? mediaKind(read.src!) : null;
    if (!read || !kind) {
      out.push(token);
      continue;
    }
    const block = new state.Token(`media_${kind}`, '', 0);
    block.map = token.map;
    block.level = token.level;
    block.meta = { image: read, written: only!.content, bavaAt: only!.meta?.bavaAt };
    out.push(block);
    i += 2;
  }
  state.tokens = out;
}

/**
 * Invisible marks onto the blocks after them; what the editor cannot edit
 * into `kept` tokens; to-dos; inline HTML into marks.
 */
function readMarksAndKept(state: CoreState & { src: string }): void {
  const src = state.src.split('\n');
  const slice = (map: [number, number]) => {
    const lines = src.slice(map[0], map[1]);
    while (lines.length > 0 && lines.at(-1)!.trim() === '') lines.pop();
    return lines.join('\n');
  };
  const out: Token[] = [];
  let pending: { pairs: MarkPair[]; token: Token } | null = null;
  // A mark with no block after it to carry it stays where it was, as written.
  const keepPending = () => {
    if (!pending) return;
    const kept = new state.Token('kept', '', 0);
    kept.content = (pending.token.meta?.keptText as string | undefined) ?? pending.token.content.trim();
    kept.level = pending.token.level;
    out.push(kept);
    pending = null;
  };
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const mark = token.type === 'html_block' ? MARK.exec(token.content.trim()) : null;
    // A contents mark with no end is kept as written, never read as a style.
    if (mark && !/^\/?contents$/.test(mark[1])) {
      keepPending();
      pending = { pairs: readMark(mark[1]), token };
      continue;
    }
    const carries = token.type in APPLIES && (token.nesting === 1 || token.nesting === 0);
    if (pending && !carries) keepPending();
    const whole =
      token.type === 'html_block' || token.type === 'kept'
        ? i
        : token.type === 'table_open' && token.meta?.keep
          ? tokens.findIndex((t, j) => j > i && t.type === 'table_close' && t.level === token.level)
          : -1;
    if (whole >= 0 && (token.map || token.meta?.keptText)) {
      const kept = new state.Token('kept', '', 0);
      kept.content = (token.meta?.keptText as string | undefined) ?? slice(token.map!);
      kept.level = token.level;
      out.push(kept);
      i = whole;
      continue;
    }
    if (pending && carries) {
      token.meta = { ...token.meta, mark: pending.pairs, markLine: pending.token.map?.[0] ?? null };
      pending = null;
    }
    if (token.type === 'list_item_open' && tokens[i + 2]?.type === 'inline') {
      const inline = tokens[i + 2];
      const todo = /^\[( |x|X)\] /.exec(inline.content);
      if (todo && inline.children?.[0]?.type === 'text') {
        token.meta = { ...token.meta, checked: todo[1] !== ' ' };
        inline.children[0].content = inline.children[0].content.slice(4);
      }
    }
    if (token.type === 'inline' && token.children) token.children = inlineHtml(token.children, state.Token);
    out.push(token);
  }
  keepPending();
  state.tokens = out;
}

/** Footnotes' notes move to the foot, in the order first referred to; a note nothing cites follows. */
function readFootnotes(state: CoreState): void {
  const tokens = state.tokens;
  const notes: Token[][] = [];
  const rest: Token[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].type !== 'footnote_open') {
      rest.push(tokens[i]);
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < tokens.length; j += 1) {
      if (tokens[j].type === 'footnote_open') depth += 1;
      if (tokens[j].type === 'footnote_close') depth -= 1;
      if (depth === 0) break;
    }
    notes.push(tokens.slice(i, j + 1));
    i = j;
  }
  if (notes.length === 0) return;
  const cited: string[] = [];
  for (const token of rest) {
    for (const child of token.children ?? []) {
      if (child.type === 'footnote_ref' && !cited.includes(child.meta.label)) cited.push(child.meta.label);
    }
  }
  const order = (note: Token[]) => {
    const at = cited.indexOf(note[0].meta.label);
    return at < 0 ? cited.length : at;
  };
  const sorted = notes.map((note, i) => ({ note, i })).sort((a, b) => order(a.note) - order(b.note) || a.i - b.i);
  state.tokens = [
    ...rest,
    new state.Token('footnotes_open', 'section', 1),
    ...sorted.flatMap(({ note }) => note),
    new state.Token('footnotes_close', 'section', -1),
  ];
}

md.core.ruler.push('bava', (state) => {
  readToggles(state);
  readContents(state);
  readCallouts(state);
  readTables(state);
  readMedia(state);
  readMarksAndKept(state);
  readFootnotes(state);
});

function tight(tokens: Token[], i: number): boolean {
  return tokens[i + 2]?.hidden === true;
}

const style = (tok: Token) => markAttrs(tok.type, tok.meta?.mark as MarkPair[] | undefined);

/** A fence's first word is its language; the rest of its line is kept as written. */
function codeAttrs(tok: Token) {
  const info = tok.type === 'fence' ? tok.info.trim() : '';
  const space = info.search(/\s/);
  return {
    language: space < 0 ? info : info.slice(0, space),
    // As written, with the space or tab that sets it apart.
    meta: space < 0 ? '' : info.slice(space),
    ...style(tok),
  };
}

function mediaAttrs(tok: Token) {
  const read = tok.meta.image as ImageRead;
  return { src: read.src, alt: read.alt, title: read.title, written: tok.meta.written, ...style(tok) };
}

const parser = new MarkdownParser(schema, md, {
  paragraph: { block: 'paragraph', getAttrs: style },
  heading: { block: 'heading', getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)), ...style(tok) }) },
  blockquote: { block: 'blockquote', getAttrs: style },
  callout: { block: 'callout', getAttrs: (tok) => ({ ...tok.meta.callout, ...style(tok) }) },
  toggle: { block: 'toggle', getAttrs: (tok) => ({ open: tok.meta.open }) },
  toggle_summary: { block: 'toggle_summary' },
  bullet_list: { block: 'bullet_list', getAttrs: (tok, tokens, i) => ({ tight: tight(tokens, i), ...style(tok) }) },
  ordered_list: {
    block: 'ordered_list',
    getAttrs: (tok, tokens, i) => {
      const { list, ...rest } = style(tok);
      return { order: Number(tok.attrGet('start') ?? 1), tight: tight(tokens, i), style: list ?? '1', ...rest };
    },
  },
  list_item: { block: 'list_item', getAttrs: (tok) => ({ checked: (tok.meta?.checked as boolean | undefined) ?? null }) },
  fence: { block: 'code_block', noCloseToken: true, getAttrs: codeAttrs },
  code_block: { block: 'code_block', noCloseToken: true, getAttrs: codeAttrs },
  math_block: { node: 'math_block', getAttrs: (tok) => ({ tex: tok.content, oneLine: tok.meta.oneLine }) },
  math_inline: { node: 'math_inline', getAttrs: (tok) => ({ tex: tok.content }) },
  footnote_ref: { node: 'footnote_ref', getAttrs: (tok) => ({ label: tok.meta.label }) },
  footnotes: { block: 'footnotes' },
  footnote: { block: 'footnote', getAttrs: (tok) => ({ label: tok.meta.label }) },
  contents: { node: 'contents' },
  table: { block: 'table' },
  table_row: { block: 'table_row' },
  table_header: { block: 'table_header', getAttrs: (tok) => tok.meta.cell },
  table_cell: { block: 'table_cell', getAttrs: (tok) => tok.meta.cell },
  media_image: { node: 'image', getAttrs: mediaAttrs },
  media_video: { node: 'video', getAttrs: mediaAttrs },
  hr: { node: 'horizontal_rule' },
  hardbreak: { node: 'hard_break' },
  kept: { node: 'kept', getAttrs: (tok) => ({ text: tok.content }) },
  keptInline: { node: 'keptInline', getAttrs: (tok) => ({ text: tok.content }) },
  date: { node: 'date', getAttrs: (tok) => ({ date: tok.meta.date, text: tok.meta.text }) },
  em: { mark: 'em' },
  strong: { mark: 'strong' },
  s: { mark: 'strike' },
  code_inline: { mark: 'code', noCloseToken: true },
  link: { mark: 'link', getAttrs: (tok) => ({ href: tok.attrGet('href'), title: tok.attrGet('title') || null }) },
  underline: { mark: 'underline' },
  color: { mark: 'color', getAttrs: (tok) => ({ name: tok.attrGet('name') }) },
  highlight: { mark: 'highlight', getAttrs: (tok) => ({ name: tok.attrGet('name') }) },
});

// ---- writing ----------------------------------------------------------------

/** The invisible mark a block carries, written on the line before it. */
function writeMark(state: MarkdownSerializerState, node: Node) {
  const a = node.attrs;
  const keys = [
    a.width ? `width=${a.width}` : '',
    a.ratio ? `ratio=${a.ratio}` : '',
    a.align ? `align=${a.align}` : '',
    a.style && a.style !== '1' ? `list=${a.style}` : '',
    a.wrap ? 'wrap' : '',
    a.caption !== null && a.caption !== undefined ? `caption="${encodeValue(a.caption)}"` : '',
    a.poster ? `poster="${encodeValue(a.poster)}"` : '',
    a.loop ? 'loop' : '',
    a.muted ? 'muted' : '',
    a.color ? `color=${a.color}` : '',
    a.background ? `background=${a.background}` : '',
    a.icon ? `icon=${/[\s"=>]|--/.test(a.icon) ? `"${encodeValue(a.icon)}"` : a.icon}` : '',
    a.extra ?? '',
  ].filter(Boolean);
  if (keys.length === 0) return;
  state.write(`<!-- bava: ${keys.join(' ')} -->`);
  state.ensureNewLine();
}

/** Writes text exactly as given, with no escaping at all. */
function writeRaw(state: MarkdownSerializerState, text: string) {
  const out = state as unknown as { out: string };
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    state.write();
    out.out += line + (i < lines.length - 1 ? '\n' : '');
  });
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The page's headings, for the contents block: set while a page is written. */
let pageHeadings: HeadingEntry[] = [];
/** Footnote labels in the order their references are first read: set while a page is written. */
let pageRefOrder: string[] = [];

/** The contents list: each heading linked by GitHub's anchor, nested under the nearest larger one above. */
function contentsLines(): string[] {
  return pageHeadings.map((h) => `${'  '.repeat(h.depth)}- [${h.text.replace(/[\\[\]]/g, '\\$&')}](#${h.slug})`);
}

/** Blocks that can follow a line of text with no blank line between. */
const INTERRUPTS = new Set(['code_block', 'bullet_list', 'ordered_list', 'blockquote', 'callout', 'heading', 'math_block']);

/**
 * A list as it can be written: tight only when every item's later blocks can
 * follow the one before with no blank line. Otherwise loose, so the first
 * save reads back as it was written.
 */
function asWritten(list: Node): Node {
  if (!list.attrs.tight) return list;
  let tight = true;
  list.forEach((item) => {
    item.forEach((child, _offset, i) => {
      if (i > 0 && !INTERRUPTS.has(child.type.name)) tight = false;
    });
  });
  return tight ? list : list.type.create({ ...list.attrs, tight: false }, list.content, list.marks);
}

/**
 * Whether a table needs the HTML form: a merged cell, a colour, a width, a
 * header column, no header row, or a cell aligned unlike its column's header.
 */
function needsHtml(table: Node): boolean {
  const map = TableMap.get(table);
  let rich = false;
  table.forEach((row, _rowOffset, r) => {
    row.forEach((cell) => {
      const a = cell.attrs;
      if (a.colspan > 1 || a.rowspan > 1 || a.background || (a.colwidth ?? []).some((w: number) => w > 0)) rich = true;
      if ((r === 0) !== (cell.type.name === 'table_header')) rich = true;
    });
  });
  if (rich) return true;
  for (let col = 0; col < map.width; col += 1) {
    const align = table.nodeAt(map.map[col])!.attrs.align;
    for (let row = 1; row < map.height; row += 1) {
      if (table.nodeAt(map.map[row * map.width + col])!.attrs.align !== align) return true;
    }
  }
  return false;
}

/**
 * A cell's text as Markdown for a table row: breaks as `<br>`, pipes
 * escaped, and no space at either edge, which every reader trims.
 */
function cellMarkdown(cell: Node): string {
  const content = cell.firstChild!;
  // The Markdown writer drops a paragraph's closing breaks: they are added back.
  let trailing = 0;
  while (trailing < content.childCount && content.child(content.childCount - 1 - trailing).type.name === 'hard_break') trailing += 1;
  const paragraph = schema.nodes.paragraph.create(null, content.content.cut(0, content.content.size - trailing));
  const text = serializer.serialize(schema.nodes.doc.create(null, paragraph)).replace(/\s+$/, '');
  return `${text.replace(/\\\n/g, '<br>').replace(/\n/g, ' ').replace(/\|/g, '\\|').trim()}${'<br>'.repeat(trailing)}`;
}

/** The Markdown form: cells padded to line up, the header line carrying each column's alignment. */
function markdownTable(table: Node): string {
  const rows: string[][] = [];
  table.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => cells.push(cellMarkdown(cell)));
    rows.push(cells);
  });
  const widths = rows[0].map((_cell, col) => Math.max(3, ...rows.map((row) => row[col]?.length ?? 0)));
  const aligns: (string | null)[] = [];
  table.firstChild!.forEach((cell) => aligns.push(cell.attrs.align));
  const line = (cells: string[]) => `| ${cells.map((cell, col) => cell.padEnd(widths[col])).join(' | ')} |`;
  const rule = `|${widths
    .map((width, col) => {
      const align = aligns[col];
      const dashes = '-'.repeat(width);
      return align === 'center' ? `:${dashes}:` : align === 'left' ? `:${dashes}-` : align === 'right' ? `-${dashes}:` : `-${dashes}-`;
    })
    .join('|')}|`;
  return [line(rows[0]), rule, ...rows.slice(1).map(line)].join('\n');
}

/** The HTML form: one row a line, widths in a colgroup when any are set. */
function htmlTable(table: Node): string {
  const map = TableMap.get(table);
  const widths: (number | null)[] = [];
  for (let col = 0; col < map.width; col += 1) {
    const pos = map.map[col];
    const cell = table.nodeAt(pos)!;
    const width = cell.attrs.colwidth?.[col - map.colCount(pos)];
    widths.push(width > 0 ? width : null);
  }
  const lines = ['<table>'];
  if (widths.some((w) => w !== null)) lines.push(`<colgroup>${widths.map((w) => (w === null ? '<col>' : `<col width="${w}">`)).join('')}</colgroup>`);
  table.forEach((row) => {
    let cells = '';
    row.forEach((cell) => {
      const a = cell.attrs;
      const tag = cell.type.name === 'table_header' ? 'th' : 'td';
      const attrs = [
        a.colspan > 1 ? ` colspan="${a.colspan}"` : '',
        a.rowspan > 1 ? ` rowspan="${a.rowspan}"` : '',
        a.align ? ` align="${a.align}"` : '',
        a.background ? ` data-background="${a.background}"` : '',
      ].join('');
      cells += `<${tag}${attrs}>${cellHtml(cell.firstChild!)}</${tag}>`;
    });
    lines.push(`<tr>${cells}</tr>`);
  });
  lines.push('</table>');
  return lines.join('\n');
}

/** What an image written as `text` reads as; null when it is not one image alone. */
function imageRead(text: string): ImageRead | null {
  const children = md.parseInline(text, {})[0]?.children ?? [];
  return children.length === 1 && children[0].type === 'keptInline' ? ((children[0].meta?.image as ImageRead | undefined) ?? null) : null;
}

/** Words as an image's words: what would read as Markdown escaped. */
const escapeAlt = (text: string) => text.replace(/[\\`*_[\]~$<&!]/g, '\\$&');

/**
 * A media block's line: as the file wrote it while that still reads as the
 * block does, else written from its address, words and title.
 */
export function mediaLine(node: Node): string {
  const { src, alt, title, written } = node.attrs as { src: string; alt: string; title: string | null; written: string | null };
  const same = (read: ImageRead | null) => read !== null && read.src === src && read.alt === alt && read.title === title;
  if (written !== null && same(imageRead(written))) return written;
  const titled = title === null ? '' : ` "${title.replace(/["\\]/g, '\\$&')}"`;
  const plain = `![${escapeAlt(alt)}](${src}${titled})`;
  if (same(imageRead(plain))) return plain;
  return `![${escapeAlt(alt)}](<${src.replace(/[<>\\]/g, '\\$&')}>${titled})`;
}

function writeMedia(state: MarkdownSerializerState, node: Node) {
  writeMark(state, node);
  writeRaw(state, mediaLine(node));
  state.closeBlock(node);
}

const base = defaultMarkdownSerializer;

const serializer = new MarkdownSerializer(
  {
    paragraph(state, node) {
      writeMark(state, node);
      state.renderInline(node);
      state.closeBlock(node);
    },
    heading(state, node) {
      writeMark(state, node);
      state.write(`${'#'.repeat(node.attrs.level)} `);
      state.renderInline(node, false);
      state.closeBlock(node);
    },
    blockquote(state, node) {
      writeMark(state, node);
      state.wrapBlock('> ', null, node, () => state.renderContent(node));
    },
    callout(state, node) {
      writeMark(state, node);
      const { kind, fold, title } = node.attrs;
      state.wrapBlock('> ', null, node, () => {
        state.write(`[!${kind}]${fold}${title ?? ''}`);
        const first = node.firstChild!;
        const empty = node.childCount === 1 && first.isTextblock && first.content.size === 0;
        if (empty) return;
        // Only plain text can follow the marker's line; anything else would be
        // read as more of that line, so a blank line comes first.
        const plain = first.type.name === 'paragraph' && !first.attrs.color && !first.attrs.background && !first.attrs.extra;
        if (plain) state.ensureNewLine();
        else state.closeBlock(node);
        state.renderContent(node);
      });
    },
    toggle(state, node) {
      state.write(`<details${node.attrs.open ? ' open' : ''}>`);
      state.ensureNewLine();
      state.write(`<summary>${escapeHtml(node.firstChild!.textContent)}</summary>`);
      state.closeBlock(node.firstChild!);
      node.forEach((child, _offset, i) => {
        if (i > 0) state.render(child, node, i);
      });
      state.write('</details>');
      state.closeBlock(node);
    },
    toggle_summary() {
      // Written by its toggle.
    },
    code_block(state, node) {
      writeMark(state, node);
      const info = `${node.attrs.language}${node.attrs.meta}`;
      // Backticks, unless the opening line holds one, which only a tilde fence allows.
      const mark = info.includes('`') ? '~' : '`';
      const runs = node.textContent.match(mark === '`' ? /`{3,}/g : /~{3,}/g) ?? [];
      const fence = mark.repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
      state.write(`${fence}${info}\n`);
      writeRaw(state, node.textContent);
      state.write('\n');
      state.write(fence);
      state.closeBlock(node);
    },
    math_block(state, node) {
      const tex = node.attrs.tex as string;
      if (node.attrs.oneLine && !tex.includes('\n')) {
        writeRaw(state, `$$${tex}$$`);
      } else {
        state.write('$$\n');
        writeRaw(state, tex);
        state.ensureNewLine();
        state.write('$$');
      }
      state.closeBlock(node);
    },
    contents(state, node) {
      // Blank lines keep the closing mark out of the list's last item.
      const lines = contentsLines();
      const block = ['<!-- bava: contents -->', '', ...lines, ...(lines.length > 0 ? [''] : []), '<!-- bava: /contents -->'];
      writeRaw(state, block.join('\n'));
      state.closeBlock(node);
    },
    // In the order their references are first read, as they are read back.
    footnotes(state, node) {
      const order = (label: string) => {
        const at = pageRefOrder.indexOf(label);
        return at < 0 ? Infinity : at;
      };
      const notes: { note: Node; i: number }[] = [];
      node.forEach((note, _offset, i) => notes.push({ note, i }));
      notes.sort((a, b) => order(a.note.attrs.label) - order(b.note.attrs.label) || a.i - b.i);
      notes.forEach(({ note }, i) => state.render(note, node, i));
    },
    footnote(state, node) {
      state.wrapBlock('    ', `[^${node.attrs.label}]: `, node, () => state.renderContent(node));
    },
    table(state, node) {
      writeRaw(state, needsHtml(node) ? htmlTable(node) : markdownTable(node));
      state.closeBlock(node);
    },
    // Written by their table.
    table_row() {},
    table_header() {},
    table_cell() {},
    image: writeMedia,
    video: writeMedia,
    horizontal_rule(state, node) {
      state.write('---');
      state.closeBlock(node);
    },
    bullet_list(state, node) {
      writeMark(state, node);
      state.renderList(asWritten(node), '  ', () => '- ');
    },
    ordered_list(state, node) {
      writeMark(state, node);
      node = asWritten(node);
      const start = node.attrs.order ?? 1;
      const width = String(start + node.childCount - 1).length;
      const space = ' '.repeat(width + 2);
      state.renderList(node, space, (i) => {
        const n = String(start + i);
        return ' '.repeat(width - n.length) + n + '. ';
      });
    },
    list_item(state, node) {
      if (node.attrs.checked !== null) state.write(node.attrs.checked ? '[x] ' : '[ ] ');
      // In a tight list an item's blocks follow each other with no blank line,
      // which would make the list loose when read back.
      const internals = state as unknown as { inTightList: boolean; flushClose: (size: number) => void };
      if (!internals.inTightList) {
        state.renderContent(node);
        return;
      }
      node.forEach((child, _offset, i) => {
        if (i > 0) internals.flushClose(1);
        state.render(child, node, i);
      });
    },
    kept(state, node) {
      state.text(node.attrs.text, false);
      state.closeBlock(node);
    },
    // As written: not even the `!` before a `[` that plain text gets.
    keptInline(state, node) {
      writeRaw(state, node.attrs.text);
    },
    math_inline(state, node) {
      writeRaw(state, `$${node.attrs.tex}$`);
    },
    date(state, node) {
      writeRaw(state, dateTag(node.attrs.date, node.attrs.text));
    },
    footnote_ref(state, node, parent, index) {
      // At a line's start and before a `:`, it would read back as a note: the colon is escaped.
      const next = parent.maybeChild(index + 1);
      const colon = index === 0 && next?.isText === true && next.text!.startsWith(':');
      writeRaw(state, `[^${node.attrs.label}]${colon ? '\\' : ''}`);
    },
    hard_break: base.nodes.hard_break,
    text: base.nodes.text,
  },
  {
    color: { open: (_state, mark: Mark) => `<span data-color="${mark.attrs.name}">`, close: '</span>' },
    highlight: { open: (_state, mark: Mark) => `<span data-highlight="${mark.attrs.name}">`, close: '</span>' },
    strong: { open: '**', close: '**', mixable: true, expelEnclosingWhitespace: true },
    em: { open: '*', close: '*', mixable: true, expelEnclosingWhitespace: true },
    underline: { open: '<u>', close: '</u>' },
    strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
    link: base.marks.link,
    code: base.marks.code,
  },
  {
    hardBreakNodeName: 'hard_break',
    // Typed text that would read back as HTML, an entity or an equation.
    escapeExtraCharacters: /<(?=[A-Za-z/!?])|&(?=#?[A-Za-z0-9]+;)|\$/g,
  },
);

// ---- the page ---------------------------------------------------------------

export type Page = { doc: Node; front: FrontMatter };

/**
 * Lists side by side that Bava would write the same way are one list: written
 * apart, they would merge on the next read, so a second save would change the
 * page. Joined here, the first save is the last change.
 */
function joinLists(node: Node): Node {
  if (node.isLeaf || node.isTextblock) return node;
  const children: Node[] = [];
  node.forEach((child) => {
    const next = joinLists(child);
    const before = children.at(-1);
    const sameList =
      before &&
      before.type === next.type &&
      (next.type.name === 'bullet_list' || next.type.name === 'ordered_list') &&
      ['style', 'color', 'background', 'extra'].every((key) => before.attrs[key] === next.attrs[key]);
    if (sameList) {
      children[children.length - 1] = before.type.create(
        { ...before.attrs, tight: before.attrs.tight && next.attrs.tight },
        before.content.append(next.content),
      );
    } else {
      children.push(next);
    }
  });
  return node.copy(Fragment.fromArray(children));
}

// ---- where links are in a page's text -----------------------------------

/** A place in the page's text: a start and an end, in the text as read (line breaks as `\n`). */
type Span = [number, number];

type Definition = { label: string; dest: Span };

/** What reading a page for its links notes as it goes. */
type LinkReading = {
  /** The text read, and where each of its lines starts. */
  src: string;
  lines: number[];
  /** Where each line of the inline text being read starts in the page; null when it cannot be placed. */
  bases: number[] | null;
  /** The first line of a callout's text after its marker, while that text is read again. */
  calloutMap: [number, number] | null;
  /** Which cell of its row a pipe-table cell is. */
  cellIndex: number;
  /** The inline text being read is a pipe-table cell's. */
  cell: boolean;
  definitions: Definition[];
  /** Labels already defined, placed or not. */
  seen: Set<string>;
};

type LinkEnv = { bavaLinks?: LinkReading; references?: Record<string, unknown> };

type LinkPlace = { dest: Span | null; label: Span | null; ref: string | null; cell: boolean };

function lineText(reading: LinkReading, line: number): string {
  const start = reading.lines[line];
  const end = line + 1 < reading.lines.length ? reading.lines[line + 1] - 1 : reading.src.length;
  return reading.src.slice(start, end);
}

/**
 * Where each line of a block's inline text starts in the page. A paragraph's
 * lines are its file lines less their container's marks (`>`, a list's
 * indent), so each is the end of its line; a heading's words sit before any
 * closing `#`; a table cell's words follow a `|`, left to right.
 */
function lineBases(reading: LinkReading, content: string, map: [number, number], cell: boolean): number[] | null {
  const bases: number[] = [];
  const parts = content.split('\n');
  for (let k = 0; k < parts.length; k += 1) {
    const line = map[0] + k;
    if (line >= reading.lines.length) return null;
    const text = lineText(reading, line);
    const part = parts[k];
    let at = -1;
    if (cell) {
      const column = rowSpans(text)[reading.cellIndex];
      if (column) {
        const raw = text.slice(column[0], column[1]);
        // A cell holding an escaped pipe is read with its backslash dropped: not placed.
        if (raw.trim() === part) at = column[0] + (raw.length - raw.trimStart().length);
      }
    } else if (text.endsWith(part)) at = text.length - part.length;
    else if (text.trimEnd().endsWith(part)) at = text.trimEnd().length - part.length;
    else {
      const i = text.lastIndexOf(part);
      if (i >= 0 && /^[\s#]*$/.test(text.slice(i + part.length))) at = i;
    }
    if (at < 0) return null;
    bases.push(reading.lines[line] + at);
  }
  return bases;
}

/**
 * Where each cell of a pipe-table row is in its line, split as markdown-it
 * splits it: at every `|` not escaped, the empty pieces before a leading `|`
 * and after a trailing one dropped.
 */
function rowSpans(line: string): Span[] {
  const lead = /^(?:[ \t]*>)*[ \t]*/.exec(line)![0].length;
  const end = line.trimEnd().length;
  const cells: Span[] = [];
  let start = lead;
  for (let i = lead; i < end; i += 1) {
    if (line[i] === '|' && line[i - 1] !== '\\') {
      cells.push([start, i]);
      start = i + 1;
    }
  }
  cells.push([start, end]);
  if (cells.length > 0 && cells[0][0] === cells[0][1]) cells.shift();
  if (cells.length > 0 && cells.at(-1)![0] === cells.at(-1)![1]) cells.pop();
  return cells;
}

/** A place in the inline text being read, as a place in the page; null when it cannot be placed. */
function placeOf(state: StateInline, reading: LinkReading, span: Span): Span | null {
  if (!reading.bases) return null;
  const at = (offset: number) => {
    let line = 0;
    let start = 0;
    for (let i = 0; i < offset; i += 1) {
      if (state.src[i] === '\n') {
        line += 1;
        start = i + 1;
      }
    }
    return reading.bases![line] + (offset - start);
  };
  const place: Span = [at(span[0]), at(span[1])];
  // Placed right only if the page holds the same text there.
  return reading.src.slice(place[0], place[1]) === state.src.slice(span[0], span[1]) ? place : null;
}

/** Where a link's words and address are, from the `[` that starts it. */
function linkPlace(state: StateInline, start: number, reading: LinkReading): LinkPlace {
  const cell = reading.cell;
  const labelEnd = state.md.helpers.parseLinkLabel(state, start, true);
  if (labelEnd < 0) return { dest: null, label: null, ref: null, cell };
  const label = placeOf(state, reading, [start + 1, labelEnd]);
  if (state.src[labelEnd + 1] === '(') {
    let pos = labelEnd + 2;
    while (pos < state.posMax && (state.src[pos] === ' ' || state.src[pos] === '\n')) pos += 1;
    const dest = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
    return { dest: dest.ok ? placeOf(state, reading, [pos, dest.pos]) : null, label, ref: null, cell };
  }
  // A reference: [words][label], [label][] or [label].
  let name = state.src.slice(start + 1, labelEnd);
  if (state.src[labelEnd + 1] === '[') {
    const second = state.md.helpers.parseLinkLabel(state, labelEnd + 1, false);
    if (second > labelEnd + 2) name = state.src.slice(labelEnd + 2, second);
  }
  return { dest: null, label, ref: state.md.utils.normalizeReference(name), cell };
}

/** A reference definition's address, noted where it is in the page. */
function noteDefinition(state: StateBlock, startLine: number): void {
  const reading = (state.env as LinkEnv).bavaLinks;
  if (!reading) return;
  // Only a definition whose address is on its own first line is placed: a
  // later line still holds its container's marks (`>`, a list's indent).
  const from = state.bMarks[startLine] + state.tShift[startLine];
  const text = state.src.slice(from, state.eMarks[startLine]);
  const close = /^\[((?:[^\\\]]|\\.)*)\]:/.exec(text);
  if (!close) return;
  // Only the first definition of a label is the one the page uses.
  const name = state.md.utils.normalizeReference(close[1]);
  if (reading.seen.has(name)) return;
  reading.seen.add(name);
  let pos = close[0].length;
  while (pos < text.length && /\s/.test(text[pos])) pos += 1;
  const dest = state.md.helpers.parseLinkDestination(text, pos, text.length);
  if (!dest.ok || dest.pos === pos) return;
  const label = state.md.utils.normalizeReference(close[1]);
  // Placed only when it reads back as the reference the page holds.
  const held = (state.env as LinkEnv).references?.[label] as { href?: string } | undefined;
  if (held?.href !== state.md.normalizeLink(dest.str)) return;
  if (!reading.definitions.some((d) => d.label === label)) reading.definitions.push({ label, dest: [from + pos, from + dest.pos] });
}

/** The address of each `<a href>` in one of Bava's HTML tables, in order, onto its link tokens. */
function noteTableLinks(state: CoreState, block: Token, tokens: Token[]): void {
  const reading = (state.env as LinkEnv).bavaLinks;
  if (!reading || !block.map) return;
  const bases = lineBases(reading, block.content.replace(/\n$/, ''), block.map, false);
  const opens = tokens.flatMap((t) => [t, ...(t.children ?? [])]).filter((t) => t.type === 'link_open');
  const anchors = anchorPlaces(block.content);
  if (!bases || !anchors || anchors.length !== opens.length) return;
  const lineStarts = [0];
  for (let i = 0; i < block.content.length; i += 1) if (block.content[i] === '\n') lineStarts.push(i + 1);
  const place = (span: [number, number] | null): Span | null => {
    if (!span) return null;
    const at = (offset: number) => {
      let line = 0;
      while (line + 1 < lineStarts.length && lineStarts[line + 1] <= offset) line += 1;
      return bases[line] + (offset - lineStarts[line]);
    };
    const out: Span = [at(span[0]), at(span[1])];
    return reading.src.slice(out[0], out[1]) === block.content.slice(span[0], span[1]) ? out : null;
  };
  anchors.forEach((anchor, i) => {
    opens[i].meta = { ...opens[i].meta, bavaAt: { dest: place(anchor.href), label: place(anchor.words), ref: null, cell: false }, bavaHtml: true };
  });
}

/** A link as the Document reads it, and where it sits in the page's text. */
export type PageLink = {
  /** The address, as the Document's link holds it. */
  href: string;
  /** Its words, when they are one plain run of text; null when formatted. */
  text: string | null;
  /** Where its address is in the page (a reference link's is its definition's); null when it cannot be placed. */
  dest: Span | null;
  /** Where its words are, for an inline link; null otherwise. */
  label: Span | null;
  /** In one of Bava's HTML tables, where text is HTML. */
  html: boolean;
  /** In a pipe table's cell, where `|` is written `\\|`. */
  cell: boolean;
  /**
   * A link; a media block's address; or a video's poster, whose `href` is
   * its file's name in the attachments folder and whose `dest` is its whole
   * `poster=` key in the mark.
   */
  kind: 'link' | 'media' | 'poster';
};

/**
 * Every link the Document reads in a page, with where its address and words
 * are in the page's text: what a rename rewrites, and what "Linked from"
 * counts, read exactly as the Document reads the page.
 */
export function pageLinks(markdown: string): PageLink[] {
  const { body } = readFront(markdown);
  const bodyAt = markdown.length - body.length;
  // The text as markdown-it reads it (line breaks as \n, NUL as U+FFFD), and
  // where each of its characters was in the page.
  let src = '';
  const original: number[] = [];
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '\r') {
      if (body[i + 1] === '\n') continue;
      src += '\n';
    } else src += body[i] === '\0' ? '\uFFFD' : body[i];
    original.push(bodyAt + i);
  }
  original.push(bodyAt + body.length);
  const lines = [0];
  for (let i = 0; i < src.length; i += 1) if (src[i] === '\n') lines.push(i + 1);
  const reading: LinkReading = { src, lines, bases: null, calloutMap: null, cellIndex: -1, cell: false, definitions: [], seen: new Set() };
  const tokens = md.parse(src, { bavaLinks: reading } satisfies LinkEnv);
  // A span's end is just past its last character, so a CR before a line's
  // LF stays outside it.
  const back = (span: Span | null): Span | null =>
    span ? [original[span[0]], span[1] > span[0] ? original[span[1] - 1] + 1 : original[span[0]]] : null;
  const out: PageLink[] = [];
  const walk = (list: Token[]) => {
    list.forEach((token, i) => {
      if (token.children) walk(token.children);
      if (token.type !== 'link_open') return;
      const place = token.meta?.bavaAt as LinkPlace | undefined;
      const close = list.findIndex((t, j) => j > i && t.type === 'link_close');
      const inside = list.slice(i + 1, close < 0 ? i + 1 : close);
      const text = inside.length === 1 && inside[0].type === 'text' ? inside[0].content : null;
      const definition = place?.ref ? reading.definitions.find((d) => d.label === place.ref) : undefined;
      out.push({
        href: token.attrGet('href') ?? '',
        text,
        dest: back(place?.ref ? (definition?.dest ?? null) : (place?.dest ?? null)),
        label: place?.ref ? null : back(place?.label ?? null),
        html: token.meta?.bavaHtml === true,
        cell: place?.cell ?? false,
        kind: 'link',
      });
    });
  };
  const media = (token: Token) => {
    const place = token.meta.bavaAt as LinkPlace | undefined;
    const read = token.meta.image as ImageRead;
    out.push({ href: read.src, text: null, dest: back(place?.dest ?? null), label: null, html: false, cell: false, kind: 'media' });
    const poster = markAttrs(token.type, token.meta.mark as MarkPair[] | undefined).poster as string | undefined;
    if (poster === undefined) return;
    out.push({ href: poster, text: null, dest: back(posterPlace(reading, token.meta.markLine as number | null, poster)), label: null, html: false, cell: false, kind: 'poster' });
  };
  for (const token of tokens) {
    if (token.type === 'media_image' || token.type === 'media_video') media(token);
    else walk([token]);
  }
  return out;
}

/** Where a mark's `poster=` key naming `name` is in the page, from the mark's line; null when it cannot be placed. */
function posterPlace(reading: LinkReading, line: number | null, name: string): Span | null {
  if (line === null || line >= reading.lines.length) return null;
  const text = lineText(reading, line);
  const open = /<!--\s*bava:\s*/.exec(text);
  const close = text.lastIndexOf('-->');
  if (!open || close < 0) return null;
  const from = open.index + open[0].length;
  const pair = readMark(text.slice(from, close)).find((p) => p.key === 'poster' && p.value === name);
  if (!pair) return null;
  // The pairs are read in order, so the first with this text is this one.
  let at = from;
  for (const match of text.slice(from, close).matchAll(/([^\s="]+)(?:=("[^"]*"|\S*))?/g)) {
    if (match[0] === pair.raw) {
      at += match.index;
      return [reading.lines[line] + at, reading.lines[line] + at + pair.raw.length];
    }
  }
  return null;
}

/** The file a mark's written `poster=` key names; null when it is not one. */
export function posterOf(written: string): string | null {
  const pairs = readMark(written);
  return pairs.length === 1 && pairs[0].key === 'poster' && VALID.poster(pairs[0].value) ? (pairs[0].value as string) : null;
}

/** A mark's `poster=` key naming a file: in quotes, unless it was written without and the name needs none. */
export const posterKey = (name: string, quoted = true) => (quoted || /[\s"]|--/.test(name) ? `poster="${encodeValue(name)}"` : `poster=${name}`);

/**
 * The address a link's written address reads as, as the Document reads it:
 * in a Markdown link or definition, or (`html`) an HTML table's `href`.
 */
export function addressOf(written: string, html: boolean): string | null {
  if (html) return decodeHTML(written);
  const dest = md.helpers.parseLinkDestination(written, 0, written.length);
  return dest.ok && dest.pos === written.length ? md.normalizeLink(dest.str) : null;
}

/** The words a link's written words read as, when they are plain: escapes and (`html`) entities read. */
export function wordsOf(written: string, html: boolean): string {
  return html ? decodeHTML(written) : md.utils.unescapeAll(written);
}

/** Reads a page's prose: its front matter and its document. */
export function parsePage(markdown: string): Page {
  const { front, body } = readFront(markdown);
  return { doc: settleTables(joinLists(parser.parse(body))), front };
}

/**
 * Tables as the table editor expects them: every row as wide as the table,
 * and a column's width on each of its cells, not only on the first row's.
 */
function settleTables(doc: Node): Node {
  const state = EditorState.create({ doc });
  const tr = fixTables(state);
  return tr ? tr.doc : doc;
}

/** Reads Markdown that is not a whole page (pasted text): no front matter. */
export function parseBody(markdown: string): Node {
  return settleTables(joinLists(parser.parse(markdown)));
}

/** Writes a page's prose in Bava's style: front matter, then the document. */
export function writePage(doc: Node, front: FrontMatter): string {
  pageHeadings = headingEntries(doc);
  pageRefOrder = [];
  doc.descendants((node) => {
    if (node.type.name === 'footnote_ref' && !pageRefOrder.includes(node.attrs.label)) pageRefOrder.push(node.attrs.label);
  });
  const body = serializer.serialize(doc, { tightLists: false });
  return writeFront(front) + (body.trim() === '' ? '' : `${body.replace(/\s+$/, '')}\n`);
}
