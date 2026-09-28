/**
 * What a page's document can hold: the blocks and marks of
 * docs/file-format.md ("The document"). Blocks this version cannot edit are
 * one `kept` node holding their Markdown verbatim; inline HTML it does not
 * know is one `keptInline` node. Nothing read from a file is dropped.
 *
 * Footnotes sit in one `footnotes` block, always last, as they are written.
 */
import { formatDay, isDay, plainDateWords } from './dates';
import { Schema, type DOMOutputSpec, type Node } from 'prosemirror-model';
import { tableNodes } from 'prosemirror-tables';
import { calloutLook } from './callout-look';

/**
 * Tables: a cell holds one paragraph of formatted text, with a colour from
 * the swatches and an alignment; spans and widths are the table package's.
 */
const tables = tableNodes({
  tableGroup: 'block',
  cellContent: 'paragraph',
  cellAttributes: {
    background: {
      default: null,
      getFromDOM: (dom) => dom.getAttribute('data-background'),
      setDOMAttr: (value, attrs) => {
        if (value) attrs['data-cell-background'] = value;
      },
    },
    align: {
      default: null,
      getFromDOM: (dom) => dom.getAttribute('align'),
      setDOMAttr: (value, attrs) => {
        if (value) attrs['data-align'] = value;
      },
    },
  },
});

/** A block's colours and unknown invisible-mark keys, shared by every styled block. */
const styled = {
  color: { default: null as string | null },
  background: { default: null as string | null },
  /** Keys of the block's invisible mark that Bava does not know, kept as written. */
  extra: { default: null as string | null },
};

function styleAttrs(node: Node): Record<string, string> {
  const out: Record<string, string> = {};
  if (node.attrs.color) out['data-color'] = node.attrs.color;
  if (node.attrs.background) out['data-background'] = node.attrs.background;
  return out;
}

export const schema = new Schema({
  nodes: {
    doc: { content: 'block* footnotes?' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: styled,
      toDOM: (node): DOMOutputSpec => ['p', styleAttrs(node), 0],
      parseDOM: [{ tag: 'p' }],
    },
    heading: {
      group: 'block',
      content: 'inline*',
      defining: true,
      attrs: { level: { default: 1 }, ...styled },
      toDOM: (node): DOMOutputSpec => [`h${node.attrs.level}`, styleAttrs(node), 0],
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
    },
    blockquote: {
      group: 'block',
      content: 'block+',
      defining: true,
      attrs: styled,
      toDOM: (node): DOMOutputSpec => ['blockquote', styleAttrs(node), 0],
      parseDOM: [{ tag: 'blockquote' }],
    },
    horizontal_rule: {
      group: 'block',
      toDOM: (): DOMOutputSpec => ['hr'],
      parseDOM: [{ tag: 'hr' }],
    },
    bullet_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { tight: { default: true }, ...styled },
      toDOM: (node): DOMOutputSpec => ['ul', styleAttrs(node), 0],
      parseDOM: [{ tag: 'ul' }],
    },
    ordered_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { order: { default: 1 }, tight: { default: true }, style: { default: '1' }, ...styled },
      toDOM: (node): DOMOutputSpec => [
        'ol',
        { ...styleAttrs(node), start: String(node.attrs.order), type: node.attrs.style },
        0,
      ],
      parseDOM: [{ tag: 'ol' }],
    },
    list_item: {
      content: 'paragraph block*',
      defining: true,
      /** A to-do: `null` for an ordinary item, else done or not. */
      attrs: { checked: { default: null as boolean | null } },
      toDOM: (node): DOMOutputSpec =>
        node.attrs.checked === null ? ['li', 0] : ['li', { 'data-checked': String(node.attrs.checked) }, 0],
      parseDOM: [{ tag: 'li' }],
    },
    /**
     * A callout: `kind` as written in the file (`info`, `note`, `success`,
     * `warning`, `error`, or another kept as is); a custom one is a note with
     * a colour and an icon. An Obsidian title and fold sign are kept.
     */
    callout: {
      group: 'block',
      content: 'block+',
      defining: true,
      attrs: {
        kind: { default: 'note' },
        icon: { default: null as string | null },
        title: { default: null as string | null },
        fold: { default: '' },
        ...styled,
      },
      // The icon and a title from the file are shown, never typed into.
      toDOM: (node): DOMOutputSpec => [
        'aside',
        {
          class: 'callout',
          'data-look': calloutLook(node.attrs.kind),
          ...(node.attrs.color ? { 'data-swatch': node.attrs.color } : {}),
        },
        [
          'div',
          { class: 'callout-side', contenteditable: 'false' },
          node.attrs.icon ? ['span', { class: 'callout-emoji' }, node.attrs.icon] : ['span', { class: 'callout-icon' }],
        ],
        [
          'div',
          { class: 'callout-main' },
          ...(node.attrs.title ? [['div', { class: 'callout-title', contenteditable: 'false' }, String(node.attrs.title).trim()] as DOMOutputSpec] : []),
          ['div', { class: 'callout-body' }, 0],
        ],
      ],
    },
    /** A toggle list: a summary line, then what it folds. `open` is the file's own. */
    toggle: {
      group: 'block',
      content: 'toggle_summary block*',
      defining: true,
      attrs: { open: { default: false } },
      toDOM: (): DOMOutputSpec => ['div', { class: 'toggle' }, 0],
    },
    toggle_summary: {
      content: 'text*',
      marks: '',
      defining: true,
      toDOM: (): DOMOutputSpec => ['div', { class: 'toggle-summary' }, 0],
    },
    /** Code, as page text: `language` is the fence's first word, `meta` the rest of its line. */
    code_block: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      attrs: {
        language: { default: '' },
        meta: { default: '' },
        wrap: { default: false },
        caption: { default: null as string | null },
        extra: { default: null as string | null },
      },
      toDOM: (node): DOMOutputSpec => ['pre', { 'data-language': node.attrs.language }, ['code', 0]],
    },
    /** A `$$` equation; `oneLine` when the file wrote it on one line. */
    math_block: {
      group: 'block',
      atom: true,
      attrs: { tex: { default: '' }, oneLine: { default: false } },
      toDOM: (node): DOMOutputSpec => ['div', { class: 'math-block' }, node.attrs.tex],
      leafText: (node) => node.attrs.tex as string,
    },
    /** The page's headings as links, rebuilt from them; written out on save. */
    contents: {
      group: 'block',
      atom: true,
      toDOM: (): DOMOutputSpec => ['nav', { class: 'contents' }],
    },
    footnotes: {
      content: 'footnote+',
      toDOM: (): DOMOutputSpec => ['section', { class: 'footnotes' }, 0],
    },
    /** A footnote's text; `label` as written in the file. */
    footnote: {
      content: 'block+',
      defining: true,
      attrs: { label: { default: '1' } },
      toDOM: (node): DOMOutputSpec => ['div', { class: 'footnote', 'data-label': node.attrs.label }, 0],
    },
    ...tables,
    /** A block Bava cannot edit yet, kept byte for byte. */
    kept: {
      group: 'block',
      atom: true,
      selectable: true,
      attrs: { text: { default: '' } },
      toDOM: (node): DOMOutputSpec => ['pre', { class: 'kept-block', 'data-kept': '' }, node.attrs.text],
      // Copied as written.
      leafText: (node) => node.attrs.text as string,
    },
    text: { group: 'inline' },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      toDOM: (): DOMOutputSpec => ['br'],
      parseDOM: [{ tag: 'br' }],
    },
    math_inline: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: { tex: { default: '' } },
      toDOM: (node): DOMOutputSpec => ['span', { class: 'math-inline' }, node.attrs.tex],
      leafText: (node) => `$${node.attrs.tex as string}$`,
    },
    footnote_ref: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: { label: {} },
      // Its number is drawn from the page's order, never stored.
      toDOM: (node): DOMOutputSpec => ['sup', { class: 'footnote-ref', 'data-label': node.attrs.label }],
      leafText: (node) => `[^${node.attrs.label as string}]`,
    },
    /** A date chip: the day, and the words the file shows for it. */
    date: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: { date: {}, text: {} },
      toDOM: (node): DOMOutputSpec => ['time', { class: 'date-chip', datetime: node.attrs.date }, node.attrs.text],
      parseDOM: [
        {
          tag: 'time[datetime]',
          getAttrs: (dom) => {
            const date = (dom as HTMLElement).getAttribute('datetime') ?? '';
            if (!isDay(date)) return false;
            const text = (dom as HTMLElement).textContent ?? '';
            return { date, text: text && plainDateWords(text) ? text : formatDay(date) };
          },
        },
      ],
      leafText: (node) => node.attrs.text as string,
    },
    /** Inline HTML or an image Bava cannot edit yet. */
    keptInline: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: { text: { default: '' } },
      toDOM: (node): DOMOutputSpec => ['code', { class: 'kept-inline' }, node.attrs.text],
      leafText: (node) => node.attrs.text as string,
    },
  },
  marks: {
    // Written outermost first: colours around everything, code innermost.
    color: {
      attrs: { name: {} },
      toDOM: (mark): DOMOutputSpec => ['span', { 'data-color': mark.attrs.name }, 0],
    },
    highlight: {
      attrs: { name: {} },
      toDOM: (mark): DOMOutputSpec => ['span', { 'data-highlight': mark.attrs.name }, 0],
    },
    strong: { toDOM: (): DOMOutputSpec => ['strong', 0], parseDOM: [{ tag: 'strong' }, { tag: 'b' }] },
    em: { toDOM: (): DOMOutputSpec => ['em', 0], parseDOM: [{ tag: 'em' }, { tag: 'i' }] },
    underline: { toDOM: (): DOMOutputSpec => ['u', 0], parseDOM: [{ tag: 'u' }] },
    strike: { toDOM: (): DOMOutputSpec => ['s', 0], parseDOM: [{ tag: 's' }, { tag: 'del' }] },
    link: {
      attrs: { href: {}, title: { default: null as string | null } },
      inclusive: false,
      toDOM: (mark): DOMOutputSpec => ['a', { href: mark.attrs.href, title: mark.attrs.title }, 0],
      parseDOM: [{ tag: 'a[href]', getAttrs: (dom) => ({ href: (dom as HTMLElement).getAttribute('href') }) }],
    },
    code: { toDOM: (): DOMOutputSpec => ['code', 0], parseDOM: [{ tag: 'code' }] },
  },
});
