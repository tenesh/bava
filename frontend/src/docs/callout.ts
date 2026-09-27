/**
 * Callouts: Confluence's five panels and a custom one, written as the
 * `> [!kind]` callouts Obsidian and GitHub read. A custom callout is a note
 * with a colour and an emoji icon, kept in its invisible mark.
 */
import { wrapIn } from 'prosemirror-commands';
import { InputRule } from 'prosemirror-inputrules';
import type { Command } from 'prosemirror-state';
import { schema } from './schema';

export { calloutLook, type CalloutLook } from './callout-look';

/** A new custom callout's colour and icon, until the user picks others. */
export const CUSTOM_DEFAULT = { color: 'gray', icon: '💡' };

const setAttrs =
  (pos: number, change: (attrs: Record<string, unknown>) => Record<string, unknown>): Command =>
  (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (node?.type !== schema.nodes.callout) return false;
    dispatch?.(state.tr.setNodeMarkup(pos, undefined, change({ ...node.attrs })));
    return true;
  };

export const callouts = {
  /** Wraps the caret's block in a callout of `kind`, or a custom one. */
  insert(kind: string, custom?: { color: string; icon: string }): Command {
    return wrapIn(schema.nodes.callout, { kind, color: custom?.color ?? null, icon: custom?.icon ?? null });
  },
  /** One of the five kinds; a custom callout's colour and icon go. */
  setKind(pos: number, kind: string): Command {
    return setAttrs(pos, (attrs) => ({ ...attrs, kind, color: null, icon: null }));
  },
  /** A custom callout's colour; a named one becomes custom. */
  setColor(pos: number, color: string): Command {
    return setAttrs(pos, (attrs) => ({ ...attrs, kind: 'note', color, icon: attrs.icon ?? CUSTOM_DEFAULT.icon }));
  },
  /** A custom callout's icon; a named one becomes custom. */
  setIcon(pos: number, icon: string): Command {
    return setAttrs(pos, (attrs) => ({ ...attrs, kind: 'note', icon, color: attrs.color ?? CUSTOM_DEFAULT.color }));
  },
  /** Back to a plain quote, keeping what is in it. */
  toQuote(pos: number): Command {
    return (state, dispatch) => {
      const node = state.doc.nodeAt(pos);
      if (node?.type !== schema.nodes.callout) return false;
      dispatch?.(state.tr.setNodeMarkup(pos, schema.nodes.blockquote, { extra: node.attrs.extra }));
      return true;
    };
  },
};

/** `[!info]` and a space, typed at the start of a quote, turns the quote into that callout. */
export function calloutRule(): InputRule {
  return new InputRule(/^\[!(info|note|success|warning|error)\]\s$/, (state, match, start, end) => {
    const $start = state.doc.resolve(start);
    if ($start.depth < 2 || $start.node(-1).type !== schema.nodes.blockquote || $start.index(-1) !== 0) return null;
    const quote = $start.before(-1);
    return state.tr.delete(start, end).setNodeMarkup(quote, schema.nodes.callout, { kind: match[1] });
  });
}
