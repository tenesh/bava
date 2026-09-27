/**
 * The `/` menu: what it offers, how typing filters it, and the
 * plugin that knows when it is open. The menu on screen only shows what this
 * reports; its keys stay in the editor, so typing goes on filtering it.
 */
import { Plugin, PluginKey, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { MessageKey } from '../i18n/messages';
import { commands, topBlock } from './commands';
import { schema } from './schema';
import { CUSTOM_DEFAULT, callouts } from './callout';
import { folds } from './fold';
import { math } from './math';
import { insertFootnote } from './footnotes';
import { insertContents } from './contents';
import { PICKER } from './emoji';

export type SlashItem = { id: string; label: MessageKey; words: string; run: Command };

const divider: Command = (state, dispatch) => {
  const block = topBlock(state);
  if (!block) return false;
  if (dispatch) {
    const { horizontal_rule, paragraph } = schema.nodes;
    const empty = block.node.isTextblock && block.node.content.size === 0;
    const tr = empty
      ? state.tr.replaceWith(block.pos, block.pos + block.node.nodeSize, [horizontal_rule.create(), paragraph.create()])
      : state.tr.insert(block.pos + block.node.nodeSize, [horizontal_rule.create(), paragraph.create()]);
    const after = tr.mapping.map(block.pos) + (empty ? 2 : block.node.nodeSize + 2);
    dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(after))));
  }
  return true;
};

const heading = (level: number): SlashItem => ({
  id: `heading${level}`,
  label: `slash.heading${level}` as MessageKey,
  words: `heading h${level} title`,
  run: commands.turnInto('heading', level),
});

const toggleHeading = (level: number): SlashItem => ({
  id: `toggleHeading${level}`,
  label: `slash.toggleHeading${level}` as MessageKey,
  words: `toggle heading h${level} fold collapse section`,
  run: (state, dispatch, view) => {
    if (!dispatch) return true;
    let current = state;
    commands.turnInto('heading', level)(current, (tr) => {
      current = current.apply(tr);
      dispatch(tr);
    }, view);
    const block = topBlock(current);
    return block ? folds.toggleHeading(block.pos)(current, dispatch, view) : false;
  },
});

const listOf = (style: '1' | 'a' | 'i'): Command => (state, dispatch, view) => {
  if (!dispatch) return true;
  let current = state;
  commands.turnInto('ordered_list')(current, (tr) => {
    current = current.apply(tr);
    dispatch(tr);
  }, view);
  if (style !== '1') commands.listStyle(style)(current, dispatch, view);
  return true;
};

export const SLASH_ITEMS: SlashItem[] = [
  { id: 'paragraph', label: 'slash.paragraph', words: 'text paragraph plain', run: commands.turnInto('paragraph') },
  heading(1),
  heading(2),
  heading(3),
  heading(4),
  heading(5),
  heading(6),
  { id: 'bullet', label: 'slash.bullet', words: 'bulleted list bullet unordered', run: commands.turnInto('bullet_list') },
  { id: 'numbered', label: 'slash.numbered', words: 'numbered list ordered number', run: listOf('1') },
  { id: 'lettered', label: 'slash.lettered', words: 'lettered list letters alphabet', run: listOf('a') },
  { id: 'roman', label: 'slash.roman', words: 'roman numerals list', run: listOf('i') },
  { id: 'todo', label: 'slash.todo', words: 'to-do todo checkbox check task', run: commands.turnInto('todo') },
  { id: 'quote', label: 'slash.quote', words: 'quote blockquote citation', run: commands.turnInto('blockquote') },
  { id: 'divider', label: 'slash.divider', words: 'divider line rule separator', run: divider },
  { id: 'code', label: 'slash.code', words: 'code block snippet programming fence', run: commands.turnInto('code_block') },
  { id: 'toggle', label: 'slash.toggle', words: 'toggle list fold collapse details', run: folds.insertToggle },
  toggleHeading(1),
  toggleHeading(2),
  toggleHeading(3),
  { id: 'equation', label: 'slash.equation', words: 'equation math formula tex latex block', run: math.insertBlock },
  { id: 'inlineEquation', label: 'slash.inlineEquation', words: 'inline equation math formula tex latex', run: math.insertInline },
  {
    id: 'emoji',
    label: 'slash.emoji',
    words: 'emoji smiley icon picker',
    run: (state, dispatch) => {
      dispatch?.(state.tr.setMeta(PICKER, true));
      return true;
    },
  },
  { id: 'contents', label: 'slash.contents', words: 'contents table toc outline index', run: insertContents },
  { id: 'footnote', label: 'slash.footnote', words: 'footnote note reference citation source', run: insertFootnote },
  { id: 'info', label: 'slash.info', words: 'callout panel info information', run: callouts.insert('info') },
  { id: 'note', label: 'slash.note', words: 'callout panel note', run: callouts.insert('note') },
  { id: 'success', label: 'slash.success', words: 'callout panel success tip done', run: callouts.insert('success') },
  { id: 'warning', label: 'slash.warning', words: 'callout panel warning caution', run: callouts.insert('warning') },
  { id: 'error', label: 'slash.error', words: 'callout panel error danger', run: callouts.insert('error') },
  { id: 'callout', label: 'slash.callout', words: 'callout panel custom colour color icon emoji', run: callouts.insert('note', CUSTOM_DEFAULT) },
];

/** The items whose name or other words contain what was typed. */
export function filterItems(query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((item) => item.id.toLowerCase().includes(q) || item.words.includes(q));
}

export type SlashInfo = {
  query: string;
  items: SlashItem[];
  active: number;
  /** Where the `/` sits on screen, to place the menu under it. */
  at: { left: number; bottom: number };
};

type SlashState = { from: number; query: string; active: number } | null;

export const slashKey = new PluginKey<{ open: SlashState; dismissedAt: number | null }>('slash');

/** The `/` and what follows it, before the caret, at a line's start or after a space. */
function typed(state: EditorState): { from: number; query: string } | null {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const match = /(?:^|\s)\/([^\s/]*)$/.exec(before);
  if (!match) return null;
  return { from: $from.pos - match[1].length - 1, query: match[1] };
}

/** Removes what was typed for the menu, then runs the item. */
export function runItem(view: EditorView, item: SlashItem): void {
  const open = slashKey.getState(view.state)?.open;
  if (open) view.dispatch(view.state.tr.delete(open.from, view.state.selection.from).setMeta(slashKey, { close: true }));
  item.run(view.state, view.dispatch, view);
}

export function slashPlugin(report: (info: SlashInfo | null) => void): Plugin {
  let last = '';
  return new Plugin({
    key: slashKey,
    state: {
      init: (): { open: SlashState; dismissedAt: number | null } => ({ open: null, dismissedAt: null }),
      apply(tr, prev, _old, state): { open: SlashState; dismissedAt: number | null } {
        const meta = tr.getMeta(slashKey) as { close?: boolean; dismiss?: boolean; active?: number } | undefined;
        const now = typed(state);
        if (!now) return { open: null, dismissedAt: null };
        if (meta?.close) return { open: null, dismissedAt: prev.dismissedAt };
        if (meta?.dismiss || prev.dismissedAt === now.from) return { open: null, dismissedAt: now.from };
        const count = filterItems(now.query).length;
        const kept = prev.open && prev.open.from === now.from ? prev.open.active : 0;
        const active = Math.max(0, Math.min(count - 1, meta?.active ?? kept));
        return { open: { ...now, active }, dismissedAt: null };
      },
    },
    props: {
      handleKeyDown(view, event) {
        const open = slashKey.getState(view.state)?.open;
        if (!open) return false;
        const items = filterItems(open.query);
        const move = (by: number) =>
          view.dispatch(view.state.tr.setMeta(slashKey, { active: (open.active + by + items.length) % Math.max(1, items.length) }));
        if (event.key === 'ArrowDown') move(1);
        else if (event.key === 'ArrowUp') move(-1);
        else if (event.key === 'Enter' && items[open.active]) runItem(view, items[open.active]);
        else if (event.key === 'Escape') view.dispatch(view.state.tr.setMeta(slashKey, { dismiss: true }));
        else return false;
        return true;
      },
    },
    view: () => ({
      update(view) {
        const open = slashKey.getState(view.state)?.open ?? null;
        let info: SlashInfo | null = null;
        if (open) {
          let at = { left: 0, bottom: 0 };
          try {
            const coords = view.coordsAtPos(open.from);
            at = { left: coords.left, bottom: coords.bottom };
          } catch {
            // Not laid out (a test page): the menu has nowhere to sit yet.
          }
          info = { query: open.query, items: filterItems(open.query), active: open.active, at };
        }
        const key = info ? `${info.query}|${info.active}|${info.at.left}|${info.at.bottom}` : '';
        if (key === last) return;
        last = key;
        report(info);
      },
    }),
  });
}
