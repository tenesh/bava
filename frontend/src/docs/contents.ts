/**
 * The contents block: the page's headings as links, nested under the nearest
 * larger heading above each, with GitHub's anchors. Drawn from the page on
 * every change and written out on save, never edited by hand.
 */
import type { Node } from 'prosemirror-model';
import { Plugin, TextSelection, type Command } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView, type NodeView } from 'prosemirror-view';
import { t } from '../i18n/t';
import { schema } from './schema';
import { slugger } from './slug';

export type HeadingEntry = { text: string; level: number; depth: number; slug: string; pos: number };

/** Every heading, in page order; one with no text is left out but still counts for anchors. */
export function headingEntries(doc: Node): HeadingEntry[] {
  const slug = slugger();
  const stack: number[] = [];
  const entries: HeadingEntry[] = [];
  doc.descendants((node, pos) => {
    if (node.type !== schema.nodes.heading) return true;
    const text = node.textContent;
    const anchor = slug(text);
    while (stack.length > 0 && stack.at(-1)! >= node.attrs.level) stack.pop();
    const depth = stack.length;
    stack.push(node.attrs.level);
    if (text.trim() !== '') entries.push({ text, level: node.attrs.level, depth, slug: anchor, pos });
    return false;
  });
  return entries;
}

function draw(nav: HTMLElement, view: EditorView) {
  const entries = headingEntries(view.state.doc);
  const title = document.createElement('div');
  title.className = 'contents-title';
  title.textContent = t('contents.title');
  const children: HTMLElement[] = [title];
  if (entries.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'contents-empty';
    empty.textContent = t('contents.empty');
    children.push(empty);
  }
  for (const entry of entries) {
    const link = document.createElement('a');
    link.href = `#${entry.slug}`;
    link.textContent = entry.text;
    link.dataset.depth = String(entry.depth);
    link.style.setProperty('--depth', String(entry.depth));
    link.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const target = headingEntries(view.state.doc).find((e) => e.slug === entry.slug);
      if (!target) return;
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, target.pos + 1)).scrollIntoView());
      view.focus();
    });
    link.addEventListener('click', (event) => event.preventDefault());
    children.push(link);
  }
  nav.replaceChildren(...children);
}

export function contentsView(_node: Node, view: EditorView): NodeView {
  const nav = document.createElement('nav');
  nav.className = 'contents';
  nav.contentEditable = 'false';
  draw(nav, view);
  return {
    dom: nav,
    // The headings changed: the plugin's decoration carries them, so the list redraws.
    update(next) {
      if (next.type !== schema.nodes.contents) return false;
      draw(nav, view);
      return true;
    },
    ignoreMutation: () => true,
    stopEvent: (event) => event.type === 'mousedown' || event.type === 'click',
  };
}

/** Tells each contents block when the headings change, so it redraws. */
export function contentsPlugin(): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const signature = headingEntries(state.doc)
          .map((e) => `${e.depth}:${e.text}`)
          .join('\n');
        const marks: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (node.type === schema.nodes.contents) marks.push(Decoration.node(pos, pos + 1, { 'data-headings': String(signature.length) + ':' + hash(signature) }));
          return !node.isTextblock;
        });
        return DecorationSet.create(state.doc, marks);
      },
    },
  });
}

function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** A contents block after the caret's block, or in place of an empty line. */
export const insertContents: Command = (state, dispatch) => {
  const { $from } = state.selection;
  if (dispatch) {
    const contents = schema.nodes.contents.create();
    const empty = $from.depth === 1 && $from.parent.isTextblock && $from.parent.content.size === 0;
    const tr = empty
      ? state.tr.replaceWith($from.before(1), $from.after(1), contents)
      : state.tr.insert($from.depth === 0 ? $from.pos : $from.after(1), contents);
    dispatch(tr.scrollIntoView());
  }
  return true;
};
