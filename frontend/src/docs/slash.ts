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
import { callouts } from './callout';
import { folds } from './fold';
import { math } from './math';
import { tables } from './table';
import { insertFootnote } from './footnotes';
import { insertContents } from './contents';
import { PICKER } from './emoji';
import { ADDRESS_ASK, MEDIA_PICKER } from './media';

/** The `/` menu's groups, shown as labels in its one list. */
export type SlashGroup = 'basic' | 'advanced' | 'inline';

export type SlashItem = { id: string; group: SlashGroup; label: MessageKey; words: string; run: Command };

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
  group: 'basic',
  label: `slash.heading${level}` as MessageKey,
  words: `heading h${level} title`,
  run: commands.turnInto('heading', level),
});

/** A transaction's ask of the app for something from the canvas: a frame to embed, or Diagram from Code. */
export const CANVAS_ASK = 'bava-canvas-ask';

/** Asks the app for a frame to embed, or a diagram from code, which it puts at the caret. */
const askCanvas =
  (what: 'embed' | 'diagram'): Command =>
  (state, dispatch) => {
    dispatch?.(state.tr.setMeta(CANVAS_ASK, what));
    return true;
  };

/** Asks the app for images or videos, which it adds at the caret. */
const chooseMedia =
  (kind: 'image' | 'video' | 'file'): Command =>
  (state, dispatch) => {
    dispatch?.(state.tr.setMeta(MEDIA_PICKER, kind));
    return true;
  };

/**
 * Leaves the caret on an empty line asking for a web address (pasted there,
 * it becomes a card or a video): the line it is on, or a new one after it.
 */
const askAddress =
  (kind: 'weblink' | 'onlinevideo'): Command =>
  (state, dispatch) => {
    if (!dispatch) return true;
    const tr = state.tr;
    const { $from } = tr.selection;
    if ($from.parent.content.size > 0) {
      const after = $from.after();
      tr.insert(after, schema.nodes.paragraph.create());
      tr.setSelection(TextSelection.create(tr.doc, after + 1));
    }
    dispatch(tr.setMeta(ADDRESS_ASK, kind).scrollIntoView());
    return true;
  };

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
  // Basic: text and its structure.
  { id: 'paragraph', group: 'basic', label: 'slash.paragraph', words: 'text paragraph plain', run: commands.turnInto('paragraph') },
  heading(1),
  heading(2),
  heading(3),
  heading(4),
  heading(5),
  heading(6),
  { id: 'bullet', group: 'basic', label: 'slash.bullet', words: 'bulleted list bullet unordered', run: commands.turnInto('bullet_list') },
  { id: 'numbered', group: 'basic', label: 'slash.numbered', words: 'numbered list ordered number lettered roman', run: listOf('1') },
  { id: 'todo', group: 'basic', label: 'slash.todo', words: 'to-do todo checkbox check task', run: commands.turnInto('todo') },
  { id: 'toggle', group: 'basic', label: 'slash.toggle', words: 'toggle list fold collapse details', run: folds.insertToggle },
  { id: 'quote', group: 'basic', label: 'slash.quote', words: 'quote blockquote citation', run: commands.turnInto('blockquote') },
  { id: 'divider', group: 'basic', label: 'slash.divider', words: 'divider line rule separator', run: divider },
  // Advanced: blocks with their own look or behaviour; a callout's kind is switched afterwards.
  {
    id: 'callout',
    group: 'advanced',
    label: 'slash.callout',
    words: 'callout panel box info note success warning error custom',
    run: callouts.insert('info'),
  },
  { id: 'table', group: 'advanced', label: 'slash.table', words: 'table grid rows columns spreadsheet', run: tables.insert },
  { id: 'code', group: 'advanced', label: 'slash.code', words: 'code block snippet programming fence', run: commands.turnInto('code_block') },
  { id: 'equation', group: 'advanced', label: 'slash.equation', words: 'equation math formula tex latex block', run: math.insertBlock },
  { id: 'contents', group: 'advanced', label: 'slash.contents', words: 'contents table toc outline index', run: insertContents },
  { id: 'image', group: 'advanced', label: 'slash.image', words: 'image picture photo screenshot media', run: chooseMedia('image') },
  { id: 'video', group: 'advanced', label: 'slash.video', words: 'video movie clip recording media', run: chooseMedia('video') },
  { id: 'onlinevideo', group: 'advanced', label: 'slash.onlineVideo', words: 'online video youtube vimeo loom embed', run: askAddress('onlinevideo') },
  { id: 'file', group: 'advanced', label: 'slash.file', words: 'file attachment pdf document upload card', run: chooseMedia('file') },
  { id: 'weblink', group: 'advanced', label: 'slash.webLink', words: 'web link bookmark card url website', run: askAddress('weblink') },
  { id: 'embedFrame', group: 'advanced', label: 'slash.embedFrame', words: 'embed frame canvas picture drawing', run: askCanvas('embed') },
  { id: 'diagram', group: 'advanced', label: 'slash.diagram', words: 'diagram from code d2 flowchart graph chart', run: askCanvas('diagram') },
  // Inline: put in the line itself.
  { id: 'inlineEquation', group: 'inline', label: 'slash.inlineEquation', words: 'inline equation math formula tex latex', run: math.insertInline },
  { id: 'footnote', group: 'inline', label: 'slash.footnote', words: 'footnote reference citation source', run: insertFootnote },
  {
    id: 'emoji',
    group: 'inline',
    label: 'slash.emoji',
    words: 'emoji smiley picker',
    run: (state, dispatch) => {
      dispatch?.(state.tr.setMeta(PICKER, true));
      return true;
    },
  },
];

/**
 * The items whose name or other words contain what was typed; in a table
 * cell, which holds one line, only those that go inside a line.
 */
export function filterItems(query: string, inLine = false): SlashItem[] {
  const q = query.trim().toLowerCase();
  const offered = inLine ? SLASH_ITEMS.filter((item) => item.group === 'inline') : SLASH_ITEMS;
  if (!q) return offered;
  return offered.filter((item) => item.id.toLowerCase().includes(q) || item.words.includes(q));
}

const inTableCell = (state: EditorState) => {
  const { $from } = state.selection;
  return $from.depth > 1 && ['table_cell', 'table_header'].includes($from.node(-1).type.name);
};

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
        const count = filterItems(now.query, inTableCell(state)).length;
        const kept = prev.open && prev.open.from === now.from ? prev.open.active : 0;
        const active = Math.max(0, Math.min(count - 1, meta?.active ?? kept));
        return { open: { ...now, active }, dismissedAt: null };
      },
    },
    props: {
      handleKeyDown(view, event) {
        const open = slashKey.getState(view.state)?.open;
        if (!open) return false;
        const items = filterItems(open.query, inTableCell(view.state));
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
          info = { query: open.query, items: filterItems(open.query, inTableCell(view.state)), active: open.active, at };
        }
        const key = info ? `${info.query}|${info.active}|${info.at.left}|${info.at.bottom}` : '';
        if (key === last) return;
        last = key;
        report(info);
      },
    }),
  });
}
