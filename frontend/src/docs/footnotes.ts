/**
 * Footnotes: a reference in the text and its note at the foot of the page.
 * Numbers count in reading order and are drawn, never written: the file keeps
 * each footnote's own label. A note whose last reference is deleted is left
 * out when the page is saved; a note nothing ever referred to stays.
 */
import { Fragment, type Node } from 'prosemirror-model';
import { Plugin, TextSelection, type Command } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { t } from '../i18n/t';
import { schema } from './schema';

/** Each referenced label's number, in the order the references are first read. */
export function footnoteNumbers(doc: Node): Map<string, number> {
  const numbers = new Map<string, number>();
  doc.descendants((node) => {
    if (node.type === schema.nodes.footnote_ref && !numbers.has(node.attrs.label)) numbers.set(node.attrs.label, numbers.size + 1);
    return true;
  });
  return numbers;
}

function refCounts(doc: Node): Map<string, number> {
  const counts = new Map<string, number>();
  doc.descendants((node) => {
    if (node.type === schema.nodes.footnote_ref) counts.set(node.attrs.label, (counts.get(node.attrs.label) ?? 0) + 1);
    return true;
  });
  return counts;
}

/** The footnotes section, always the page's last block, if there is one. */
function section(doc: Node): { node: Node; pos: number } | null {
  const last = doc.lastChild;
  return last?.type === schema.nodes.footnotes ? { node: last, pos: doc.content.size - last.nodeSize } : null;
}

function notePos(doc: Node, label: string): number | null {
  const foot = section(doc);
  if (!foot) return null;
  let found: number | null = null;
  foot.node.forEach((note, offset) => {
    if (found === null && note.attrs.label === label) found = foot.pos + 1 + offset;
  });
  return found;
}

function refPos(doc: Node, label: string): number | null {
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type === schema.nodes.footnote_ref && node.attrs.label === label) found = pos;
    return true;
  });
  return found;
}

function goTo(view: EditorView, pos: number, into: boolean) {
  const $pos = view.state.doc.resolve(into ? pos + 1 : pos);
  const selection = into ? TextSelection.near($pos) : TextSelection.create(view.state.doc, pos + 1);
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  view.focus();
}

function backLink(label: string) {
  return (view: EditorView) => {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'footnote-back';
    back.contentEditable = 'false';
    back.textContent = '↩';
    back.setAttribute('aria-label', t('footnote.back'));
    back.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const ref = refPos(view.state.doc, label);
      if (ref !== null) goTo(view, ref, false);
    });
    return back;
  };
}

/**
 * The page as it is saved: a note whose last reference was deleted while
 * editing is left out. It stays in the editor until then, so a sentence cut
 * and pasted elsewhere keeps its note. A note the file already had with
 * nothing referring to it is kept.
 */
export function withoutDroppedNotes(doc: Node, loaded: Node): Node {
  const foot = section(doc);
  if (!foot) return doc;
  const refs = refCounts(doc);
  const unreferencedWhenRead = new Set<string>();
  const loadedFoot = section(loaded);
  const loadedRefs = refCounts(loaded);
  loadedFoot?.node.forEach((note) => {
    if (!loadedRefs.get(note.attrs.label)) unreferencedWhenRead.add(note.attrs.label);
  });
  const kept: Node[] = [];
  foot.node.forEach((note) => {
    if (refs.get(note.attrs.label) || unreferencedWhenRead.has(note.attrs.label)) kept.push(note);
  });
  if (kept.length === foot.node.childCount) return doc;
  const content = doc.content.replaceChild(doc.childCount - 1, foot.node.copy(Fragment.fromArray(kept)));
  return doc.copy(kept.length > 0 ? content : content.cut(0, foot.pos));
}

export function footnotesPlugin(): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const numbers = footnoteNumbers(state.doc);
        const shown: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (node.type === schema.nodes.footnote_ref) {
            const n = numbers.get(node.attrs.label);
            shown.push(Decoration.node(pos, pos + node.nodeSize, { 'data-number': String(n ?? node.attrs.label) }));
          } else if (node.type === schema.nodes.footnote) {
            const n = numbers.get(node.attrs.label);
            shown.push(Decoration.node(pos, pos + node.nodeSize, { 'data-number': n ? String(n) : node.attrs.label }));
            // At the end of the note's last line of text, or after the note when
            // it ends in another block; not on an empty line, where the caret is.
            const last = node.lastChild;
            const end = last?.isTextblock ? pos + node.nodeSize - 2 : pos + node.nodeSize - 1;
            const blank = last?.isTextblock === true && last.content.size === 0;
            if (n && !blank) shown.push(Decoration.widget(end, backLink(node.attrs.label), { side: 1, key: `back-${node.attrs.label}` }));
          }
          return true;
        });
        return DecorationSet.create(state.doc, shown);
      },
      handleClickOn(view, _pos, node) {
        if (node.type !== schema.nodes.footnote_ref) return false;
        const note = notePos(view.state.doc, node.attrs.label);
        if (note === null) return false;
        goTo(view, note, true);
        return true;
      },
    },
  });
}

/** A new footnote: its reference at the caret, its note at the foot, the caret in the note. */
export const insertFootnote: Command = (state, dispatch) => {
  if (dispatch) {
    const taken = new Set<string>();
    state.doc.descendants((node) => {
      if (node.type === schema.nodes.footnote_ref || node.type === schema.nodes.footnote) taken.add(node.attrs.label);
      return true;
    });
    let n = 1;
    while (taken.has(String(n))) n += 1;
    const label = String(n);
    const tr = state.tr.replaceSelectionWith(schema.nodes.footnote_ref.create({ label }), false);
    const note = schema.nodes.footnote.create({ label }, schema.nodes.paragraph.create());
    const foot = section(tr.doc);
    let inside: number;
    if (foot) {
      const at = foot.pos + foot.node.nodeSize - 1;
      tr.insert(at, note);
      inside = at + 2;
    } else {
      const at = tr.doc.content.size;
      tr.insert(at, schema.nodes.footnotes.create(null, note));
      inside = at + 3;
    }
    dispatch(tr.setSelection(TextSelection.create(tr.doc, inside)).scrollIntoView());
  }
  return true;
};
