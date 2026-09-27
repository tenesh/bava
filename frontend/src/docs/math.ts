/**
 * Equations: TeX drawn with KaTeX (MIT; its fonts, SIL OFL 1.1, bundled),
 * as a block (`$$…$$`) or inside a line (`$…$`). The TeX is edited in a
 * field over the page, never as page text; a formula that does not parse
 * shows its TeX and the reason, never a blank.
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { InputRule } from 'prosemirror-inputrules';
import type { Node } from 'prosemirror-model';
import { NodeSelection, Plugin, type Command } from 'prosemirror-state';
import type { EditorView, NodeView } from 'prosemirror-view';
import { t } from '../i18n/t';
import { schema } from './schema';

/** Where an equation sits on screen, for the field that edits it. */
export type EquationAt = { left: number; top: number; bottom: number };

/** Draws `tex` into `el`; a formula that does not parse shows its TeX and why. */
export function renderTex(tex: string, el: HTMLElement, display: boolean): void {
  el.replaceChildren();
  if (tex.trim() === '') {
    const empty = document.createElement('span');
    empty.className = 'math-empty';
    empty.textContent = t('equation.empty');
    el.append(empty);
    return;
  }
  try {
    // Untrusted: no links, no pictures, nothing fetched.
    katex.render(tex, el, { displayMode: display, throwOnError: true, trust: false, strict: 'ignore' });
  } catch (error) {
    el.replaceChildren();
    const source = document.createElement('span');
    source.className = 'math-source';
    source.textContent = tex;
    const reason = document.createElement('span');
    reason.className = 'math-error';
    reason.textContent = error instanceof Error ? error.message.replace(/^KaTeX parse error: /, '') : String(error);
    el.append(source, reason);
  }
}

const isMath = (node: Node | null | undefined) => node?.type === schema.nodes.math_block || node?.type === schema.nodes.math_inline;

function place(el: HTMLElement): EquationAt {
  const box = el.getBoundingClientRect();
  return { left: box.left, top: box.top, bottom: box.bottom };
}

/** An equation in the page: drawn, and a press opens its field. */
export function mathView(
  node: Node,
  view: EditorView,
  getPos: () => number | undefined,
  onEquation: (pos: number, at: EquationAt) => void,
): NodeView {
  const display = node.type === schema.nodes.math_block;
  const dom = document.createElement(display ? 'div' : 'span');
  dom.className = display ? 'math-block' : 'math-inline';
  let tex = node.attrs.tex as string;
  renderTex(tex, dom, display);
  dom.addEventListener('mousedown', (event) => {
    event.preventDefault();
    const pos = getPos();
    if (pos !== undefined && view.editable) onEquation(pos, place(dom));
  });
  return {
    dom,
    update(next) {
      if (next.type !== node.type) return false;
      if (next.attrs.tex !== tex) {
        tex = next.attrs.tex;
        renderTex(tex, dom, display);
      }
      return true;
    },
    ignoreMutation: () => true,
    stopEvent: (event) => event.type === 'mousedown',
  };
}

/** Where the equation at `pos` is drawn, for opening its field from the keyboard. */
function placeOf(view: EditorView, pos: number): EquationAt {
  const dom = view.nodeDOM(pos);
  if (dom instanceof HTMLElement) return place(dom);
  const coords = view.coordsAtPos(pos);
  return { left: coords.left, top: coords.top, bottom: coords.bottom };
}

/**
 * Asks for an equation's TeX when one is selected empty (just inserted), and
 * on Enter over a selected one.
 */
export function mathPlugin(onEquation: (pos: number, at: EquationAt) => void): Plugin {
  const ask = (view: EditorView, pos: number) => {
    try {
      onEquation(pos, placeOf(view, pos));
    } catch {
      onEquation(pos, { left: 0, top: 0, bottom: 0 });
    }
  };
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        const { selection } = view.state;
        if (event.key !== 'Enter' || !(selection instanceof NodeSelection) || !isMath(selection.node) || !view.editable) return false;
        ask(view, selection.from);
        return true;
      },
    },
    view: () => ({
      update(view, prev) {
        const { selection } = view.state;
        if (!(selection instanceof NodeSelection) || !isMath(selection.node) || selection.node.attrs.tex !== '') return;
        if (prev.selection instanceof NodeSelection && prev.selection.from === selection.from && prev.doc.eq(view.state.doc)) return;
        ask(view, selection.from);
      },
    }),
  });
}

/** Replaces the selection with `node` and selects it, so its field opens. */
function insertSelected(make: () => Node, block: boolean): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    if (dispatch) {
      const node = make();
      let tr = state.tr;
      let at: number;
      if (block && $from.parent.isTextblock && $from.parent.content.size === 0 && $from.depth > 0) {
        at = $from.before();
        tr = tr.replaceWith(at, $from.after(), node);
      } else if (block) {
        at = $from.after(Math.max(1, $from.depth));
        tr = tr.insert(at, node);
      } else {
        at = state.selection.from;
        tr = tr.replaceSelectionWith(node, false);
      }
      dispatch(tr.setSelection(NodeSelection.create(tr.doc, at)).scrollIntoView());
    }
    return true;
  };
}

/** How many backslashes end `text`: an odd run escapes what follows. */
const trailingSlashes = (text: string) => /\\*$/.exec(text)![0].length;

/**
 * TeX as the file can hold it. Inside a line: on one line, trimmed, with any
 * `$` escaped, so it reads back as the same equation. On its own: no line of
 * `$$` alone, which would end it early.
 */
export function cleanTex(tex: string, inline: boolean): string {
  if (!inline) return tex.replace(/^[ \t]*\$\$[ \t]*$/gm, '\\$\\$');
  const oneLine = tex.replace(/\s*\n\s*/g, ' ').trim();
  return oneLine.replace(/\$/g, (dollar, at: number) => (trailingSlashes(oneLine.slice(0, at)) % 2 === 0 ? '\\$' : dollar));
}

export const math = {
  insertBlock: insertSelected(() => schema.nodes.math_block.create(), true),
  insertInline: insertSelected(() => schema.nodes.math_inline.create(), false),

  /** Sets the equation at `pos`; TeX left empty deletes the equation. */
  setTex(pos: number, typed: string): Command {
    return (state, dispatch) => {
      const node = state.doc.nodeAt(pos);
      if (!isMath(node)) return false;
      const tex = cleanTex(typed, node!.type === schema.nodes.math_inline);
      if (dispatch) {
        if (tex.trim() === '') {
          const blockAlone = node!.type === schema.nodes.math_block;
          dispatch(
            blockAlone
              ? state.tr.replaceWith(pos, pos + node!.nodeSize, schema.nodes.paragraph.create())
              : state.tr.delete(pos, pos + node!.nodeSize),
          );
        } else {
          dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node!.attrs, tex }));
        }
      }
      return true;
    };
  },
};

/** Enter after `$$` alone on a line makes a block equation there. */
export const mathKeys: Record<string, Command> = {
  Enter: (state, dispatch) => {
    const { $from, empty } = state.selection;
    if (!empty || $from.depth < 1 || $from.parent.type !== schema.nodes.paragraph || $from.parent.textContent !== '$$') return false;
    if (dispatch) {
      const pos = $from.before();
      const tr = state.tr.replaceWith(pos, $from.after(), schema.nodes.math_block.create());
      dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)).scrollIntoView());
    }
    return true;
  },
};

/** `$…$` typed in a line: an inline equation, when the TeX neither starts nor ends with a space. */
export function inlineMathRule(): InputRule {
  return new InputRule(/(^|[^\\$\w])\$([^\s$](?:[^$]*[^\s$])?)\$$/, (state, match, start, end) => {
    // A closing `$` after an odd run of backslashes is escaped, not closing.
    if (trailingSlashes(match[2]) % 2 === 1) return null;
    const from = start + match[1].length;
    return state.tr.replaceWith(from, end, schema.nodes.math_inline.create({ tex: match[2] }));
  });
}
