/**
 * Toggle lists and toggle headings, and folding them.
 *
 * Whether a toggle is folded is never part of the page: it lives in the
 * editor, as decorations that follow edits, so folding cannot mark the page
 * unsaved. Bava remembers it on this computer, per page, as it remembers pane
 * sizes; a toggle it has no memory of starts folded, unless the file says
 * `<details open>`.
 */
import type { Node } from 'prosemirror-model';
import { Plugin, PluginKey, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView, type NodeView } from 'prosemirror-view';
import { t } from '../i18n/t';
import { schema } from './schema';

type FoldState = {
  /** The folded toggles and toggle headings: a node decoration each, marked `fold`. */
  folded: DecorationSet;
  /** Counts fold changes, so the memory is written when one happens. */
  version: number;
};

type FoldMeta = { toggle?: number; open?: number[] };

export const foldKey = new PluginKey<FoldState>('fold');

// ---- memory on this computer ---------------------------------------------------

const STORE = 'bava.folds:';

function readMemory(page: string): Record<string, boolean> {
  try {
    const value = JSON.parse(localStorage.getItem(STORE + page) ?? '{}') as unknown;
    return value && typeof value === 'object' ? (value as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeMemory(page: string, value: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORE + page, JSON.stringify(value));
  } catch {
    // Not remembered: the page still folds; it opens folded next time.
  }
}

/**
 * Every toggle and toggle heading, with a name that finds it again when the
 * page is reopened: its kind, its text, and which of that name it is.
 */
function foldables(doc: Node): { pos: number; node: Node; id: string }[] {
  const seen = new Map<string, number>();
  const out: { pos: number; node: Node; id: string }[] = [];
  doc.descendants((node, pos) => {
    const base =
      node.type === schema.nodes.toggle
        ? `t:${node.firstChild?.textContent ?? ''}`
        : node.type === schema.nodes.heading && node.attrs.toggle
          ? `h${node.attrs.level}:${node.textContent}`
          : null;
    if (base !== null) {
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      out.push({ pos, node, id: `${base}#${n}` });
    }
    return true;
  });
  return out;
}

// ---- what a fold hides -----------------------------------------------------------

/** A toggle heading's section: the blocks after it, up to the next heading of its size or larger. */
export function sectionOf(doc: Node, pos: number): { from: number; to: number } | null {
  const $pos = doc.resolve(pos);
  const parent = $pos.parent;
  const index = $pos.index();
  const heading = parent.maybeChild(index);
  if (heading?.type !== schema.nodes.heading) return null;
  const from = pos + heading.nodeSize;
  let to = from;
  for (let i = index + 1; i < parent.childCount; i += 1) {
    const child = parent.child(i);
    if (child.type === schema.nodes.footnotes) break;
    if (child.type === schema.nodes.heading && child.attrs.level <= heading.attrs.level) break;
    to += child.nodeSize;
  }
  return { from, to };
}

/** What a folded toggle at `pos` hides, or null when it hides nothing. */
function hiddenBy(doc: Node, pos: number): { from: number; to: number } | null {
  const node = doc.nodeAt(pos);
  if (node?.type === schema.nodes.toggle) {
    const from = pos + 1 + node.firstChild!.nodeSize;
    const to = pos + node.nodeSize - 1;
    return to > from ? { from, to } : null;
  }
  if (node?.type === schema.nodes.heading && node.attrs.toggle) {
    const section = sectionOf(doc, pos);
    return section && section.to > section.from ? section : null;
  }
  return null;
}

// ---- the plugin ------------------------------------------------------------------

function foldMark(doc: Node, pos: number): Decoration | null {
  const node = doc.nodeAt(pos);
  return node ? Decoration.node(pos, pos + node.nodeSize, {}, { fold: true }) : null;
}

/** The arrow before a toggle heading's text. */
function headingArrow(folded: boolean) {
  return (view: EditorView, getPos: () => number | undefined) => {
    const arrow = document.createElement('button');
    arrow.type = 'button';
    arrow.className = 'toggle-arrow';
    arrow.contentEditable = 'false';
    arrow.setAttribute('aria-label', t('toggle.fold'));
    arrow.setAttribute('aria-expanded', String(!folded));
    arrow.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const at = getPos();
      if (at !== undefined) view.dispatch(view.state.tr.setMeta(foldKey, { toggle: at - 1 } satisfies FoldMeta));
    });
    return arrow;
  };
}

/** Folding; `page` names the page for the memory, or null for none. */
export function foldPlugin(page: () => string | null): Plugin<FoldState> {
  return new Plugin<FoldState>({
    key: foldKey,
    state: {
      init(_config, state) {
        const name = page();
        const memory = name ? readMemory(name) : {};
        const marks = foldables(state.doc)
          .filter(({ node, id }) => !(memory[id] ?? (node.type === schema.nodes.toggle && node.attrs.open === true)))
          .map(({ pos }) => foldMark(state.doc, pos)!);
        return { folded: DecorationSet.create(state.doc, marks), version: 0 };
      },
      apply(tr, prev) {
        const meta = tr.getMeta(foldKey) as FoldMeta | undefined;
        let folded = prev.folded.map(tr.mapping, tr.doc);
        if (!meta) return folded === prev.folded ? prev : { folded, version: prev.version };
        const at = (pos: number) => folded.find(pos, pos + 1, (spec) => spec.fold === true).filter((d) => d.from === pos);
        for (const pos of meta.open ?? []) folded = folded.remove(at(pos));
        if (meta.toggle !== undefined) {
          const found = at(meta.toggle);
          const mark = found.length === 0 ? foldMark(tr.doc, meta.toggle) : null;
          folded = found.length > 0 ? folded.remove(found) : mark ? folded.add(tr.doc, [mark]) : folded;
        }
        return { folded, version: prev.version + 1 };
      },
    },
    props: {
      decorations(state) {
        const { folded } = foldKey.getState(state)!;
        const isFolded = (pos: number) => folded.find(pos, pos + 1, (spec) => spec.fold === true).some((d) => d.from === pos);
        const shown: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (node.type === schema.nodes.toggle && isFolded(pos)) {
            shown.push(Decoration.node(pos, pos + node.nodeSize, { 'data-folded': '' }, { folded: true }));
          }
          if (node.type === schema.nodes.heading && node.attrs.toggle) {
            const shut = isFolded(pos);
            shown.push(Decoration.widget(pos + 1, headingArrow(shut), { side: -1, key: `fold-${shut}`, ignoreSelection: true }));
            if (shut) {
              shown.push(Decoration.node(pos, pos + node.nodeSize, { 'data-folded': '' }));
              const section = sectionOf(state.doc, pos);
              if (section) {
                state.doc.nodesBetween(section.from, section.to, (child, childPos) => {
                  if (childPos >= section.from && childPos + child.nodeSize <= section.to) {
                    shown.push(Decoration.node(childPos, childPos + child.nodeSize, { class: 'folded-away' }));
                  }
                  return false;
                });
              }
            }
          }
          return true;
        });
        return DecorationSet.create(state.doc, shown);
      },
    },
    // A fold that the selection lands in (find, or arrowing in) opens.
    appendTransaction(trs, _old, state) {
      if (!trs.some((tr) => tr.selectionSet)) return null;
      const { from } = state.selection;
      const open = foldKey
        .getState(state)!
        .folded.find()
        .map((d) => d.from)
        .filter((pos) => {
          const hidden = hiddenBy(state.doc, pos);
          return hidden !== null && from >= hidden.from && from <= hidden.to;
        });
      return open.length > 0 ? state.tr.setMeta(foldKey, { open } satisfies FoldMeta) : null;
    },
    view: () => ({
      update(view, prev) {
        const name = page();
        const now = foldKey.getState(view.state)!;
        const before = foldKey.getState(prev);
        // Written when a fold changes, never on each keystroke.
        if (!name || now.version === before?.version) return;
        const memory: Record<string, boolean> = {};
        for (const { pos, id } of foldables(view.state.doc)) {
          memory[id] = !now.folded.find(pos, pos + 1, (spec) => spec.fold === true).some((d) => d.from === pos);
        }
        writeMemory(name, memory);
      },
    }),
  });
}

// ---- the toggle list's own arrow -----------------------------------------------------

export function toggleView(
  node: Node,
  view: EditorView,
  getPos: () => number | undefined,
  decorations: readonly Decoration[],
): NodeView {
  const dom = document.createElement('div');
  dom.className = 'toggle';
  const arrow = document.createElement('button');
  arrow.type = 'button';
  arrow.className = 'toggle-arrow';
  arrow.contentEditable = 'false';
  arrow.setAttribute('aria-label', t('toggle.fold'));
  const inner = document.createElement('div');
  inner.className = 'toggle-inner';
  dom.append(arrow, inner);
  arrow.addEventListener('mousedown', (event) => {
    event.preventDefault();
    const pos = getPos();
    if (pos !== undefined) view.dispatch(view.state.tr.setMeta(foldKey, { toggle: pos } satisfies FoldMeta));
  });
  const show = (decorations: readonly Decoration[]) =>
    arrow.setAttribute('aria-expanded', String(!decorations.some((d) => (d.spec as { folded?: boolean }).folded)));
  show(decorations);
  return {
    dom,
    contentDOM: inner,
    update(next, decorations) {
      if (next.type !== node.type) return false;
      show(decorations);
      return true;
    },
    stopEvent: (event) => arrow.contains(event.target as HTMLElement),
    ignoreMutation: (mutation) => !inner.contains(mutation.target),
  };
}

// ---- keys and commands -------------------------------------------------------------

const inSummary = (state: EditorState) => state.selection.$from.parent.type === schema.nodes.toggle_summary;

/** Enter in a summary goes into the toggle, opening it, with a line to type on if it has none. */
const enterFromSummary: Command = (state, dispatch) => {
  if (!inSummary(state)) return false;
  const { $from } = state.selection;
  const togglePos = $from.before(-1);
  const toggle = $from.node(-1);
  if (dispatch) {
    const bodyStart = $from.after();
    let tr = state.tr;
    if (toggle.childCount === 1) tr = tr.insert(bodyStart, schema.nodes.paragraph.create());
    tr = tr.setSelection(TextSelection.near(tr.doc.resolve(bodyStart + 1)));
    dispatch(tr.setMeta(foldKey, { open: [togglePos] } satisfies FoldMeta).scrollIntoView());
  }
  return true;
};

/** Backspace at the start of an empty toggle's summary turns it back into a line of text. */
const emptyToggleToText: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || !inSummary(state) || $from.parentOffset !== 0) return false;
  const toggle = $from.node(-1);
  const bodyEmpty = toggle.childCount === 1 || (toggle.childCount === 2 && toggle.child(1).isTextblock && toggle.child(1).content.size === 0);
  if ($from.parent.content.size > 0 || !bodyEmpty) return false;
  if (dispatch) {
    const pos = $from.before(-1);
    const tr = state.tr.replaceWith(pos, pos + toggle.nodeSize, schema.nodes.paragraph.create());
    dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1)));
  }
  return true;
};

export const foldKeys: Record<string, Command> = {
  Enter: enterFromSummary,
  Backspace: emptyToggleToText,
};

export const folds = {
  /** The caret's line becomes a toggle list's summary, open, with the caret at its end. */
  insertToggle: ((state, dispatch) => {
    const { $from } = state.selection;
    if (!$from.parent.isTextblock || $from.depth < 1) return false;
    if (dispatch) {
      const pos = $from.before();
      const summary = schema.nodes.toggle_summary.create(null, $from.parent.textContent ? schema.text($from.parent.textContent) : null);
      const toggle = schema.nodes.toggle.create(null, [summary, schema.nodes.paragraph.create()]);
      const tr = state.tr.replaceWith(pos, $from.after(), toggle);
      dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 1 + summary.nodeSize - 1)).scrollIntoView());
    }
    return true;
  }) satisfies Command,

  /** Makes the heading at `pos` a toggle heading, or an ordinary one again. */
  toggleHeading(pos: number): Command {
    return (state, dispatch) => {
      const node = state.doc.nodeAt(pos);
      if (node?.type !== schema.nodes.heading) return false;
      dispatch?.(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, toggle: !node.attrs.toggle }));
      return true;
    };
  },
};
