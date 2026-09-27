/**
 * A page's prose, from Markdown to a document and back, in the one style of
 * docs/file-format.md ("The document"). Reading keeps everything: what the
 * editor cannot edit is sliced from the source and written back unchanged.
 */
import MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';
import type StateInline from 'markdown-it/lib/rules_inline/state_inline.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { MarkdownParser, MarkdownSerializer, defaultMarkdownSerializer, type MarkdownSerializerState } from 'prosemirror-markdown';
import { Fragment, type Mark, type Node } from 'prosemirror-model';
import { schema } from './schema';

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

// ---- reading ----------------------------------------------------------------

const MARK = /^<!--\s*bava:\s*(.*?)\s*-->\s*$/;

/** The keys of an invisible mark: `list`, `color`, `background`, and the rest kept as written. */
function readMark(text: string): { list?: string; color?: string; background?: string; extra: string[] } {
  const out: { list?: string; color?: string; background?: string; extra: string[] } = { extra: [] };
  for (const pair of text.split(/\s+/).filter(Boolean)) {
    const [key, value] = pair.split('=');
    if (key === 'list' && (value === 'a' || value === 'i')) out.list = value;
    else if (key === 'color' && value) out.color = value;
    else if (key === 'background' && value) out.background = value;
    else out.extra.push(pair);
  }
  return out;
}

/** `$$` math blocks and footnote definitions, which this version keeps whole. */
function keptBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const lineText = (line: number) => state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
  const first = lineText(startLine);
  let last = startLine;
  if (first.startsWith('$$')) {
    if (!(first.length > 2 && first.trim().endsWith('$$') && first.trim() !== '$$')) {
      for (last = startLine + 1; last < endLine && !lineText(last).trim().startsWith('$$'); last += 1);
      if (last >= endLine) return false;
    }
  } else if (/^\[\^[^\]\s]+\]:/.test(first)) {
    // A definition runs on through indented lines.
    while (last + 1 < endLine && state.sCount[last + 1] >= state.blkIndent + 4 && lineText(last + 1) !== '') last += 1;
  } else {
    return false;
  }
  if (silent) return true;
  const token = state.push('kept', '', 0);
  token.map = [startLine, last + 1];
  state.line = last + 1;
  return true;
}

/** Footnote references and inline equations, kept exactly. */
function keptInlineRule(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const at = state.pos;
  let end: number;
  if (src.startsWith('[^', at)) {
    end = src.indexOf(']', at + 2);
    if (end < 0 || /\s/.test(src.slice(at + 2, end))) return false;
    end += 1;
  } else if (src[at] === '$' && src[at + 1] !== '$' && src[at + 1] !== ' ') {
    end = src.indexOf('$', at + 1);
    if (end < 0 || src[end - 1] === ' ') return false;
    end += 1;
  } else {
    return false;
  }
  if (!silent) state.push('keptInline', '', 0).content = src.slice(at, end);
  state.pos = end;
  return true;
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
md.block.ruler.before('fence', 'bava_kept', keptBlockRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
md.inline.ruler.before('link', 'bava_kept_inline', keptInlineRule);

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

type BlockRule = (state: StateBlock, startLine: number, endLine: number, silent: boolean) => boolean;
type RulerInternals = { __rules__: { name: string; fn: BlockRule }[] };

/**
 * A kept block's text as it sits in its container: inside a list item or a
 * quote, without the container's indent or `>` markers, which the writer puts
 * back. Taken from the file's own lines, so it is exactly what was written.
 */
// A link reference definition stays where it was written, used or not.
{
  const reference = (md.block.ruler as unknown as RulerInternals).__rules__.find((r) => r.name === 'reference')!.fn;
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

for (const name of ['fence', 'code', 'html_block', 'table', 'bava_kept']) {
  const rule = (md.block.ruler as unknown as RulerInternals).__rules__.find((r) => r.name === name)!;
  const original = rule.fn;
  md.block.ruler.at(name, (state, startLine, endLine, silent) => {
    const before = state.tokens.length;
    if (!original(state, startLine, endLine, silent)) return false;
    if (!silent && state.tokens.length > before) {
      const token = state.tokens[before];
      token.meta = { ...token.meta, keptText: state.getLines(startLine, state.line, state.blkIndent, false).replace(/\s+$/, '') };
    }
    return true;
  });
}

/** Turns what the editor cannot edit into `kept` tokens, reads invisible marks and to-dos. */
md.core.ruler.push('bava', (state) => {
  const src = state.src.split('\n');
  const slice = (map: [number, number]) => {
    const lines = src.slice(map[0], map[1]);
    while (lines.length > 0 && lines.at(-1)!.trim() === '') lines.pop();
    return lines.join('\n');
  };
  const out: Token[] = [];
  let pending: { keys: ReturnType<typeof readMark>; token: Token } | null = null;
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
    if (mark) {
      keepPending();
      pending = { keys: readMark(mark[1]), token };
      continue;
    }
    const carries = token.nesting === 1 && /^(paragraph|heading|blockquote|bullet_list|ordered_list)_open$/.test(token.type);
    if (pending && !carries) keepPending();
    const whole =
      token.type === 'fence' || token.type === 'code_block' || token.type === 'html_block' || token.type === 'kept'
        ? i
        : token.type === 'table_open'
          ? tokens.findIndex((t, j) => j > i && t.type === 'table_close' && t.level === token.level)
          : -1;
    if (whole >= 0 && token.map) {
      const kept = new state.Token('kept', '', 0);
      kept.content = (token.meta?.keptText as string | undefined) ?? slice(token.map);
      kept.level = token.level;
      out.push(kept);
      i = whole;
      continue;
    }
    if (pending && carries) {
      token.meta = { ...token.meta, mark: pending.keys };
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
});

function blockStyle(token: Token) {
  const mark = token.meta?.mark as ReturnType<typeof readMark> | undefined;
  // Only a numbered list has a list style; on any other block it is kept as written.
  const extra = [...(mark?.list && token.type !== 'ordered_list_open' ? [`list=${mark.list}`] : []), ...(mark?.extra ?? [])];
  return {
    color: mark?.color ?? null,
    background: mark?.background ?? null,
    extra: extra.length > 0 ? extra.join(' ') : null,
  };
}

function tight(tokens: Token[], i: number): boolean {
  return tokens[i + 2]?.hidden === true;
}

const parser = new MarkdownParser(schema, md, {
  paragraph: { block: 'paragraph', getAttrs: blockStyle },
  heading: { block: 'heading', getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)), ...blockStyle(tok) }) },
  blockquote: { block: 'blockquote', getAttrs: blockStyle },
  bullet_list: { block: 'bullet_list', getAttrs: (tok, tokens, i) => ({ tight: tight(tokens, i), ...blockStyle(tok) }) },
  ordered_list: {
    block: 'ordered_list',
    getAttrs: (tok, tokens, i) => ({
      order: Number(tok.attrGet('start') ?? 1),
      tight: tight(tokens, i),
      style: (tok.meta?.mark as ReturnType<typeof readMark> | undefined)?.list ?? '1',
      ...blockStyle(tok),
    }),
  },
  list_item: { block: 'list_item', getAttrs: (tok) => ({ checked: (tok.meta?.checked as boolean | undefined) ?? null }) },
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
function writeMark(state: MarkdownSerializerState, node: Node, list?: string) {
  const keys = [
    list && list !== '1' ? `list=${list}` : '',
    node.attrs.color ? `color=${node.attrs.color}` : '',
    node.attrs.background ? `background=${node.attrs.background}` : '',
    node.attrs.extra ?? '',
  ].filter(Boolean);
  if (keys.length === 0) return;
  state.write(`<!-- bava: ${keys.join(' ')} -->`);
  state.ensureNewLine();
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
    horizontal_rule(state, node) {
      state.write('---');
      state.closeBlock(node);
    },
    bullet_list(state, node) {
      writeMark(state, node);
      state.renderList(node, '  ', () => '- ');
    },
    ordered_list(state, node) {
      writeMark(state, node, node.attrs.style);
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
      state.renderContent(node);
    },
    kept(state, node) {
      state.text(node.attrs.text, false);
      state.closeBlock(node);
    },
    keptInline(state, node) {
      // As written: not even the `!` before a `[` that plain text gets.
      const out = state as unknown as { out: string };
      const lines = (node.attrs.text as string).split('\n');
      lines.forEach((line, i) => {
        state.write();
        out.out += line + (i < lines.length - 1 ? '\n' : '');
      });
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
  const body = serializer.serialize(doc, { tightLists: false });
  return writeFront(front) + (body.trim() === '' ? '' : `${body.replace(/\s+$/, '')}\n`);
}
