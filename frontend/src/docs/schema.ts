/**
 * What a page's document can hold: the blocks and marks of
 * docs/file-format.md ("The document"). Blocks this version cannot edit are
 * one `kept` node holding their Markdown verbatim; inline HTML it does not
 * know is one `keptInline` node. Nothing read from a file is dropped.
 */
import { Schema, type DOMOutputSpec, type Node } from 'prosemirror-model';

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
    doc: { content: 'block*' },
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
    /** Inline HTML, a footnote reference or an equation Bava cannot edit yet. */
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
