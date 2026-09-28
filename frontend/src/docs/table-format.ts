/**
 * Tables as the file holds them (docs/file-format.md, "Tables"): the HTML
 * form's reader, for Bava's own shape only, and its cell writer; and the
 * Markdown form's row splitting. Anything outside Bava's shape is refused, so
 * the table is kept as written.
 */
import { dateTag, isDay, plainDateWords } from './dates';
import { decodeHTML } from 'entities';
import type { Mark, Node } from 'prosemirror-model';

/** The next `close` from `from` that no backslash escapes (an even run of them is a TeX line break). */
export function closingDollar(src: string, from: number, close: string): number {
  for (let at = src.indexOf(close, from); at >= 0; at = src.indexOf(close, at + 1)) {
    let slashes = 0;
    while (src[at - 1 - slashes] === '\\') slashes += 1;
    if (slashes % 2 === 0) return at;
  }
  return -1;
}

/** A Markdown table row's cells, as markdown-it splits them: on `|` no backslash escapes. */
export function rowCells(line: string): number {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  let cells = 1;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\\') i += 1;
    else if (text[i] === '|') cells += 1;
  }
  return cells;
}

// ---- the HTML form's reader ---------------------------------------------------

export type MarkName = 'strong' | 'em' | 'underline' | 's' | 'link' | 'color' | 'highlight';

/** A cell's content, read from its HTML: text, marks opening and closing, code, breaks and equations. */
export type Piece =
  | { kind: 'text'; text: string }
  | { kind: 'open'; mark: MarkName; attrs?: Record<string, string> }
  | { kind: 'close'; mark: MarkName }
  | { kind: 'code'; text: string }
  | { kind: 'br' }
  | { kind: 'math'; tex: string }
  | { kind: 'footnote'; label: string }
  | { kind: 'date'; date: string; text: string }
  /** Inline HTML or an image Bava keeps as written. */
  | { kind: 'kept'; text: string };

export type HtmlCell = {
  header: boolean;
  /** The grid column the cell starts in, counting cells spanning down from rows above. */
  column: number;
  colspan: number;
  rowspan: number;
  align: string | null;
  background: string | null;
  pieces: Piece[];
};

export type HtmlTable = { widths: (number | null)[]; rows: HtmlCell[][] };

type Tag = { close: boolean; name: string; attrs: Record<string, string>; raw: string } | { text: string };

/** The HTML split into tags and text; null when something is not a plain tag or text. */
function tags(html: string): Tag[] | null {
  const out: Tag[] = [];
  const pattern = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z-]+(?:="[^"<>]*")?)*)\s*\/?>|([^<]+)/g;
  let at = 0;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    if (match.index !== at) return null;
    at = pattern.lastIndex;
    if (match[4] !== undefined) {
      out.push({ text: match[4] });
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const pair of match[3].matchAll(/([a-zA-Z-]+)(?:="([^"]*)")?/g)) attrs[pair[1].toLowerCase()] = pair[2] ?? '';
    out.push({ close: match[1] === '/', name: match[2].toLowerCase(), attrs, raw: match[0] });
  }
  return at === html.length ? out : null;
}

/**
 * Each `<a>` in a table's HTML, read as the table reader reads it: where its
 * `href` value and its words are in the HTML. Null when the HTML is not all
 * tags and text.
 */
export function anchorPlaces(html: string): { href: [number, number] | null; words: [number, number] | null }[] | null {
  const list = tags(html);
  if (!list) return null;
  let at = 0;
  const placed = list.map((tag) => {
    const from = at;
    at += 'text' in tag ? tag.text.length : tag.raw.length;
    return { tag, from };
  });
  const out: { href: [number, number] | null; words: [number, number] | null }[] = [];
  placed.forEach(({ tag, from }, i) => {
    if ('text' in tag || tag.name !== 'a' || tag.close) return;
    let href: [number, number] | null = null;
    // Attributes one after another, so a value holding `href=` is never taken for one.
    for (const attr of tag.raw.slice(2).matchAll(/\s+([a-zA-Z-]+)(?:="([^"]*)")?/g)) {
      if (attr[1].toLowerCase() === 'href' && attr[2] !== undefined) {
        const valueAt = from + 2 + attr.index! + attr[0].indexOf('="') + 2;
        href = [valueAt, valueAt + attr[2].length];
        break;
      }
    }
    const close = placed.slice(i + 1).find((p) => !('text' in p.tag) && p.tag.name === 'a' && p.tag.close);
    out.push({ href, words: close ? [from + tag.raw.length, close.from] : null });
  });
  return out;
}

const onlyKeys = (attrs: Record<string, string>, allowed: string[]) => Object.keys(attrs).every((key) => allowed.includes(key));

/** Tags that make a block: a cell holding one is more than a cell holds. */
const BLOCK_TAGS = new Set(['p', 'div', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'blockquote', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'details', 'summary', 'section']);

/** The mark each tag opens; a span opens a colour or a highlight, by its attribute. */
const INLINE: Record<string, MarkName> = { strong: 'strong', em: 'em', u: 'underline', s: 's', a: 'link', span: 'color' };
/** The marks each closing tag can end. */
const CLOSES: Record<string, MarkName[]> = { strong: ['strong'], em: ['em'], u: ['underline'], s: ['s'], a: ['link'], span: ['color', 'highlight'] };

/** A cell's inner HTML as pieces; null for anything a cell of Bava's cannot hold. */
function cellPieces(inner: Tag[]): Piece[] | null {
  const out: Piece[] = [];
  const open: MarkName[] = [];
  for (let i = 0; i < inner.length; i += 1) {
    const tag = inner[i];
    if ('text' in tag) {
      out.push(...textPieces(tag.text));
      continue;
    }
    if (tag.name === 'br' && !tag.close && onlyKeys(tag.attrs, [])) {
      out.push({ kind: 'br' });
      continue;
    }
    if (tag.name === 'code' && !tag.close && onlyKeys(tag.attrs, [])) {
      const text = inner[i + 1];
      const end = inner[i + 2];
      if (!text || !('text' in text) || !end || 'text' in end || end.name !== 'code' || !end.close) return null;
      out.push({ kind: 'code', text: decodeHTML(text.text) });
      i += 2;
      continue;
    }
    if (tag.name === 'time' && !tag.close && onlyKeys(tag.attrs, ['datetime']) && isDay(tag.attrs.datetime ?? '')) {
      const text = inner[i + 1];
      const end = inner[i + 2];
      if (text && 'text' in text && plainDateWords(text.text) && end && !('text' in end) && end.name === 'time' && end.close) {
        out.push({ kind: 'date', date: tag.attrs.datetime, text: text.text });
        i += 2;
        continue;
      }
    }
    const base = INLINE[tag.name];
    if (!base) {
      // A block inside a cell is more than a cell holds; other inline HTML is kept as written.
      if (BLOCK_TAGS.has(tag.name)) return null;
      out.push({ kind: 'kept', text: tag.raw });
      continue;
    }
    if (tag.close) {
      const mark = open.pop();
      if (!mark || !CLOSES[tag.name].includes(mark)) return null;
      out.push({ kind: 'close', mark });
      continue;
    }
    let mark: MarkName = base;
    let attrs: Record<string, string> | undefined;
    if (tag.name === 'a') {
      if (!onlyKeys(tag.attrs, ['href', 'title']) || tag.attrs.href === undefined) return null;
      attrs = { href: decodeHTML(tag.attrs.href), ...(tag.attrs.title !== undefined ? { title: decodeHTML(tag.attrs.title) } : {}) };
    } else if (tag.name === 'span') {
      const color = tag.attrs['data-color'];
      const highlight = tag.attrs['data-highlight'];
      if (Object.keys(tag.attrs).length !== 1 || !/^[a-z]+$/.test(color ?? highlight ?? '')) return null;
      mark = color !== undefined ? 'color' : 'highlight';
      attrs = { name: (color ?? highlight)! };
    } else if (!onlyKeys(tag.attrs, [])) {
      return null;
    }
    open.push(mark);
    out.push({ kind: 'open', mark, attrs });
  }
  return open.length === 0 ? out : null;
}

/**
 * Text from the HTML: images (kept as written), footnote references and
 * inline equations split out first, then entities decoded.
 */
function textPieces(raw: string): Piece[] {
  const out: Piece[] = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ kind: 'text', text: decodeHTML(text) });
    text = '';
  };
  for (let i = 0; i < raw.length; ) {
    const rest = raw.slice(i);
    const image = /^!\[[^\]]*\]\([^)\s]*(?:\s+"[^"]*")?\)/.exec(rest);
    const note = /^\[\^([^\]\s]+)\]/.exec(rest);
    if (image) {
      flush();
      out.push({ kind: 'kept', text: image[0] });
      i += image[0].length;
      continue;
    }
    if (note) {
      flush();
      out.push({ kind: 'footnote', label: decodeHTML(note[1]) });
      i += note[0].length;
      continue;
    }
    if (raw[i] === '$' && raw[i + 1] !== undefined && raw[i + 1] !== ' ' && raw[i + 1] !== '$') {
      const end = closingDollar(raw, i + 1, '$');
      if (end > i + 1 && raw[end - 1] !== ' ') {
        flush();
        out.push({ kind: 'math', tex: decodeHTML(raw.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    text += raw[i];
    i += 1;
  }
  flush();
  return out;
}

/** The largest span read; anything larger is not a table Bava can hold. */
const MAX_SPAN = 1000;

/**
 * Places each cell in the grid, counting cells spanning down from rows above.
 * False unless every row covers the same columns exactly once, as a table
 * Bava edits must.
 */
function placeCells(rows: HtmlCell[][]): boolean {
  const taken: boolean[][] = rows.map(() => []);
  for (let r = 0; r < rows.length; r += 1) {
    let col = 0;
    for (const cell of rows[r]) {
      while (taken[r][col]) col += 1;
      cell.column = col;
      for (let dr = 0; dr < cell.rowspan; dr += 1) {
        if (r + dr >= rows.length) return false;
        for (let dc = 0; dc < cell.colspan; dc += 1) {
          if (taken[r + dr][col + dc]) return false;
          taken[r + dr][col + dc] = true;
        }
      }
      col += cell.colspan;
    }
  }
  const width = taken[0].length;
  return taken.every((row) => row.length === width && row.every(Boolean));
}

/** An HTML table in Bava's shape, or null for any other. */
export function readHtmlTable(html: string): HtmlTable | null {
  const all = tags(html.trim());
  if (!all) return null;
  const items = all.filter((tag) => !('text' in tag) || tag.text.trim() !== '' || false);
  let i = 0;
  const next = () => items[i];
  const isTag = (tag: Tag | undefined, name: string, close = false): tag is Extract<Tag, { name: string }> =>
    !!tag && !('text' in tag) && tag.name === name && tag.close === close;
  if (!isTag(next(), 'table') || Object.keys((next() as { attrs: object }).attrs).length > 0) return null;
  i += 1;
  const widths: (number | null)[] = [];
  if (isTag(next(), 'colgroup')) {
    i += 1;
    while (isTag(next(), 'col')) {
      const col = next() as { attrs: Record<string, string> };
      if (!onlyKeys(col.attrs, ['width']) || (col.attrs.width !== undefined && !/^\d+$/.test(col.attrs.width))) return null;
      widths.push(col.attrs.width !== undefined ? Number(col.attrs.width) : null);
      i += 1;
      if (isTag(next(), 'col', true)) i += 1;
    }
    if (!isTag(next(), 'colgroup', true)) return null;
    i += 1;
  }
  const rows: HtmlCell[][] = [];
  while (i < items.length) {
    const tag = next();
    if (isTag(tag, 'thead') || isTag(tag, 'tbody') || isTag(tag, 'thead', true) || isTag(tag, 'tbody', true)) {
      if (Object.keys((tag as { attrs: object }).attrs).length > 0) return null;
      i += 1;
      continue;
    }
    if (isTag(tag, 'table', true)) {
      return i === items.length - 1 && rows.length > 0 && placeCells(rows) ? { widths, rows } : null;
    }
    if (!isTag(tag, 'tr') || Object.keys(tag.attrs).length > 0) return null;
    i += 1;
    const row: HtmlCell[] = [];
    while (!isTag(next(), 'tr', true)) {
      const cell = next();
      if (!cell || 'text' in cell || cell.close || (cell.name !== 'th' && cell.name !== 'td')) return null;
      if (!onlyKeys(cell.attrs, ['colspan', 'rowspan', 'align', 'data-background'])) return null;
      const { colspan = '1', rowspan = '1', align, 'data-background': background } = cell.attrs;
      if (!/^\d+$/.test(colspan) || !/^\d+$/.test(rowspan)) return null;
      if (Number(colspan) < 1 || Number(rowspan) < 1 || Number(colspan) > MAX_SPAN || Number(rowspan) > MAX_SPAN) return null;
      if (align !== undefined && !['left', 'center', 'right'].includes(align)) return null;
      if (background !== undefined && !/^[a-z]+$/.test(background)) return null;
      // The cell's content is everything up to its own close, blank text included.
      const from = all.indexOf(cell) + 1;
      let to = from;
      while (to < all.length && !isTag(all[to], cell.name, true)) to += 1;
      if (to >= all.length) return null;
      const pieces = cellPieces(all.slice(from, to));
      if (!pieces) return null;
      row.push({ header: cell.name === 'th', column: 0, colspan: Number(colspan), rowspan: Number(rowspan), align: align ?? null, background: background ?? null, pieces });
      i = items.indexOf(all[to]) + 1;
      if (i === 0) return null;
    }
    i += 1;
    rows.push(row);
  }
  return null;
}

// ---- the HTML form's cell writer ------------------------------------------------

// `$` and `[` would read back as an equation or a footnote reference.
const escapeText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\$/g, '&#36;').replace(/\[/g, '&#91;');
const escapeAttr = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function openTag(mark: Mark): string {
  switch (mark.type.name) {
    case 'color':
      return `<span data-color="${mark.attrs.name}">`;
    case 'highlight':
      return `<span data-highlight="${mark.attrs.name}">`;
    case 'strong':
      return '<strong>';
    case 'em':
      return '<em>';
    case 'underline':
      return '<u>';
    case 'strike':
      return '<s>';
    case 'link':
      return `<a href="${escapeAttr(mark.attrs.href)}"${mark.attrs.title ? ` title="${escapeAttr(mark.attrs.title)}"` : ''}>`;
    default:
      return '';
  }
}

function closeTag(mark: Mark): string {
  return { color: '</span>', highlight: '</span>', strong: '</strong>', em: '</em>', underline: '</u>', strike: '</s>', link: '</a>' }[mark.type.name] ?? '';
}

/** A cell's paragraph as the HTML a table cell holds: each run wrapped in its marks, outermost first. */
export function cellHtml(paragraph: Node): string {
  let out = '';
  paragraph.forEach((child) => {
    const marks = child.marks.filter((mark) => mark.type.name !== 'code');
    const code = child.marks.some((mark) => mark.type.name === 'code');
    let inner: string;
    if (child.isText) inner = code ? `<code>${escapeText(child.text!)}</code>` : escapeText(child.text!);
    else if (child.type.name === 'hard_break') inner = '<br>';
    else if (child.type.name === 'math_inline') inner = `$${escapeText(child.attrs.tex).replace(/&#36;/g, '$').replace(/&#91;/g, '[')}$`;
    else if (child.type.name === 'footnote_ref') inner = `[^${escapeText(child.attrs.label)}]`;
    else if (child.type.name === 'date') inner = dateTag(child.attrs.date, child.attrs.text);
    else inner = String(child.attrs.text ?? '');
    out += marks.map(openTag).join('') + inner + [...marks].reverse().map(closeTag).join('');
  });
  return out;
}
