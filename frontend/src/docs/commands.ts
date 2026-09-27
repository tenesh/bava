/**
 * What the editor can do to a page, as ProseMirror commands: formatting,
 * colours, turning a block into another kind, and moving, duplicating and
 * deleting blocks. Each works on a state and a dispatch, so it is tested
 * without a screen and used the same way from keys, menus and the handle.
 */
import { lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import type { Mark, MarkType, Node, NodeType } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import { liftListItem, sinkListItem, wrapInList } from 'prosemirror-schema-list';
import { schema } from './schema';

const { nodes, marks } = schema;

/** The top-level block the selection starts in, and where it starts. */
export function topBlock(state: EditorState): { node: Node; pos: number } | null {
  const $from = state.selection.$from;
  if ($from.depth === 0) {
    const node = state.doc.nodeAt($from.pos);
    return node ? { node, pos: $from.pos } : null;
  }
  return { node: $from.node(1), pos: $from.before(1) };
}

/** Sets or clears a colour mark over the selection. */
function colourMark(type: MarkType, name: string | null): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    if (dispatch) {
      const tr = state.tr.removeMark(from, to, type);
      if (name) tr.addMark(from, to, type.create({ name }));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** Lifts the selection out of every list and quote it is in. */
function unwrapAll(state: EditorState, dispatch?: (tr: import('prosemirror-state').Transaction) => void): EditorState {
  let current = state;
  for (let i = 0; i < 8; i += 1) {
    let next: EditorState | null = null;
    const apply = (tr: import('prosemirror-state').Transaction) => {
      next = current.apply(tr);
      dispatch?.(tr);
    };
    if (!liftListItem(nodes.list_item)(current, apply) && !lift(current, apply)) break;
    current = next ?? current;
  }
  return current;
}

type BlockKind = 'paragraph' | 'heading' | 'bullet_list' | 'ordered_list' | 'todo' | 'blockquote' | 'code_block';

export const commands = {
  bold: toggleMark(marks.strong),
  italic: toggleMark(marks.em),
  underline: toggleMark(marks.underline),
  strike: toggleMark(marks.strike),
  code: toggleMark(marks.code),

  /** A link over the selection; `null` removes it. */
  link(href: string | null): Command {
    return (state, dispatch) => {
      const { from, to, empty } = state.selection;
      if (empty) return false;
      if (dispatch) {
        const tr = state.tr.removeMark(from, to, marks.link);
        if (href) tr.addMark(from, to, marks.link.create({ href }));
        dispatch(tr);
      }
      return true;
    };
  },

  textColor: (name: string | null) => colourMark(marks.color, name),
  highlight: (name: string | null) => colourMark(marks.highlight, name),

  /** Colours the block the selection is in, its text and its background. */
  blockColor(colours: { color?: string | null; background?: string | null }): Command {
    return (state, dispatch) => {
      const block = topBlock(state);
      if (!block || !('color' in block.node.attrs)) return false;
      if (dispatch) {
        const attrs = { ...block.node.attrs };
        if (colours.color !== undefined) attrs.color = colours.color;
        if (colours.background !== undefined) attrs.background = colours.background;
        dispatch(state.tr.setNodeMarkup(block.pos, undefined, attrs));
      }
      return true;
    };
  },

  /** Turns the block the caret is in into another kind. */
  turnInto(kind: BlockKind, level = 1): Command {
    return (state, dispatch) => {
      if (!dispatch) return true;
      let current = state;
      const step = (tr: import('prosemirror-state').Transaction) => {
        current = current.apply(tr);
        dispatch(tr);
      };
      // Out of any list or quote first, as plain text, then into the new kind.
      current = unwrapAll(current, step);
      setBlockType(nodes.paragraph)(current, step);
      if (kind === 'heading') setBlockType(nodes.heading, { level })(current, step);
      else if (kind === 'code_block') setBlockType(nodes.code_block)(current, step);
      else if (kind === 'bullet_list') wrapInList(nodes.bullet_list)(current, step);
      else if (kind === 'ordered_list') wrapInList(nodes.ordered_list)(current, step);
      else if (kind === 'blockquote') wrapIn(nodes.blockquote)(current, step);
      else if (kind === 'todo' && wrapInList(nodes.bullet_list)(current, step)) {
        const $pos = current.selection.$from;
        for (let d = $pos.depth; d > 0; d -= 1) {
          if ($pos.node(d).type === nodes.list_item) {
            step(current.tr.setNodeMarkup($pos.before(d), undefined, { checked: false }));
            break;
          }
        }
      }
      return true;
    };
  },

  /** A numbered list shown as 1., a. or i. */
  listStyle(style: '1' | 'a' | 'i'): Command {
    return (state, dispatch) => {
      const $pos = state.selection.$from;
      for (let d = $pos.depth; d > 0; d -= 1) {
        if ($pos.node(d).type === nodes.ordered_list) {
          dispatch?.(state.tr.setNodeMarkup($pos.before(d), undefined, { ...$pos.node(d).attrs, style }));
          return true;
        }
      }
      return false;
    };
  },

  /** Ticks or unticks the to-do the caret is in. */
  toggleTodo: ((state, dispatch) => {
    const $pos = state.selection.$from;
    for (let d = $pos.depth; d > 0; d -= 1) {
      const node = $pos.node(d);
      if (node.type === nodes.list_item && node.attrs.checked !== null) {
        dispatch?.(state.tr.setNodeMarkup($pos.before(d), undefined, { checked: !node.attrs.checked }));
        return true;
      }
    }
    return false;
  }) as Command,

  sink: sinkListItem(nodes.list_item),
  lift: liftListItem(nodes.list_item),

  duplicateBlock: ((state, dispatch) => {
    const block = topBlock(state);
    if (!block) return false;
    dispatch?.(state.tr.insert(block.pos + block.node.nodeSize, block.node.copy(block.node.content)));
    return true;
  }) as Command,

  deleteBlock: ((state, dispatch) => {
    const block = topBlock(state);
    if (!block) return false;
    dispatch?.(state.tr.delete(block.pos, block.pos + block.node.nodeSize));
    return true;
  }) as Command,

  /** Moves the top-level block starting at `from` to the document position `to`. */
  moveBlock(from: number, to: number): Command {
    return (state, dispatch) => {
      const node = state.doc.nodeAt(from);
      if (!node || to === from) return false;
      if (dispatch) {
        const tr = state.tr.delete(from, from + node.nodeSize);
        tr.insert(tr.mapping.map(to), node);
        dispatch(tr);
      }
      return true;
    };
  },
};

export type { BlockKind, NodeType, Mark };
