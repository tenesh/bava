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
import { headingEntries, type HeadingEntry } from './contents';

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
  heading_open: ['color', 'background', 'toggle'],
  blockquote_open: ['color', 'background'],
  callout_open: ['color', 'background', 'icon'],
  bullet_list_open: ['color', 'background'],
  ordered_list_open: ['color', 'background', 'list'],
  fence: ['wrap', 'caption'],
  code_block: ['wrap', 'caption'],
};

const VALID: Record<string, (value: string | true) => boolean> = {
  color: (v) => typeof v === 'string' && v !== '',
  background: (v) => typeof v === 'string' && v !== '',
  icon: (v) => typeof v === 'string' && v !== '',
  list: (v) => v === 'a' || v === 'i',
  toggle: (v) => v === true,
  wrap: (v) => v === true,
  caption: (v) => typeof v === 'string',
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

/** The next `close` from `from` that no backslash escapes (an even run of them is a TeX line break). */
function closingDollar(src: string, from: number, close: string): number {
  for (let at = src.indexOf(close, from); at >= 0; at = src.indexOf(close, at + 1)) {
    let slashes = 0;
    while (src[at - 1 - slashes] === '\\') slashes += 1;
    if (slashes % 2 === 0) return at;
  }
  return -1;
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

const md = new MarkdownIt('default', { html: true, linkify: false, typographer: false });
md.block.ruler.before('fence', 'bava_math', mathBlockRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
md.block.ruler.before('reference', 'bava_footnote', footnoteRule, { alt: ['paragraph', 'reference'] });
md.inline.ruler.before('link', 'bava_inline', inlineRule);

type BlockRule = (state: StateBlock, startLine: number, endLine: number, silent: boolean) => boolean;
type RulerInternals = { __rules__: { name: string; fn: BlockRule }[] };
type InlineRule = (state: StateInline, silent: boolean) => boolean;
type InlineRulerInternals = { __rules__: { name: string; fn: InlineRule }[] };

// An image is kept exactly as written until the Document shows media.
{
  const image = (md.inline.ruler as unknown as InlineRulerInternals).__rules__.find((r) => r.name === 'image')!.fn;
  md.inline.ruler.at('image', (state, silent) => {
    const start = state.pos;
    // The text before it is its own token, so what the image pushes can be replaced.
    if (!silent && state.pending) state.pushPending();
    const before = state.tokens.length;
    if (!image(state, silent)) return false;
    if (!silent) {
      state.tokens.length = before;
      state.push('keptInline', '', 0).content = state.src.slice(start, state.pos);
    }
    return true;
  });
}

// A link reference definition stays where it was written, used or not.
{
  const reference = (md.block.ruler as unknown as RulerInternals).__rules__.find((r) => r.name === 'reference')!.fn;
  // `at` would reset what the rule can interrupt; it keeps markdown-it's own.
  md.block.ruler.at('reference', (state, startLine, endLine, silent) => {
    if (!reference(state, startLine, endLine, silent)) return false;
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
      token.meta = { ...token.meta, keptText: state.getLines(startLine, state.line, state.blkIndent, false).replace(/\s+$/, '') };
    }
    return true;
  }, { alt });
}

// ---- reading the structure ---------------------------------------------------

type CoreState = { tokens: Token[]; Token: typeof Token; md: MarkdownIt; env: unknown };

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
      inline.children = state.md.parseInline(rest, state.env)[0].children ?? [];
    }
  });
  state.tokens = tokens.filter((_, i) => !drop.has(i));
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
    const carries = token.type in APPLIES && (token.nesting === 1 || token.type === 'fence' || token.type === 'code_block');
    if (pending && !carries) keepPending();
    const whole =
      token.type === 'html_block' || token.type === 'kept'
        ? i
        : token.type === 'table_open'
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
      token.meta = { ...token.meta, mark: pending.pairs };
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
  hr: { node: 'horizontal_rule' },
  hardbreak: { node: 'hard_break' },
  kept: { node: 'kept', getAttrs: (tok) => ({ text: tok.content }) },
  keptInline: { node: 'keptInline', getAttrs: (tok) => ({ text: tok.content }) },
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
    a.style && a.style !== '1' ? `list=${a.style}` : '',
    a.toggle ? 'toggle' : '',
    a.wrap ? 'wrap' : '',
    a.caption !== null && a.caption !== undefined ? `caption="${encodeValue(a.caption)}"` : '',
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

/** Reads a page's prose: its front matter and its document. */
export function parsePage(markdown: string): Page {
  const { front, body } = readFront(markdown);
  return { doc: joinLists(parser.parse(body)), front };
}

/** Reads Markdown that is not a whole page (pasted text): no front matter. */
export function parseBody(markdown: string): Node {
  return joinLists(parser.parse(markdown));
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
