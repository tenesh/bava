/**
 * The `@` menu (also `[[`): dates, then the Space's pages. A date becomes a
 * date chip; a page becomes an ordinary link to its file, relative to this
 * page. Outside a Space it offers dates only. The pages come from the app,
 * which reads the Space when the menu opens.
 */
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { addDays, dateAttrs, isDay, monthNamed, todayDay } from './dates';
import { linkTo } from './links';

export type PageRef = { name: string; path: string };

/** A day offered, and the word it was offered by. */
export type TypedDate = { date: string; word?: 'today' | 'tomorrow' | 'yesterday' };

export type MentionItem = ({ kind: 'date' } & TypedDate) | { kind: 'page'; name: string; path: string };

export type MentionInfo = {
  items: MentionItem[];
  active: number;
  /** Where the `@` sits on screen, to place the list under it. */
  at: { left: number; bottom: number };
};

/** Where this page is in the Space (null outside one), and its pages once read. */
export type MentionSource = () => { here: string | null; pages: PageRef[] | null };

const WORDS = [
  ['today', 0],
  ['tomorrow', 1],
  ['yesterday', -1],
] as const;

/** The days a query names: today and tomorrow when empty, a word, or a day written out. */
export function typedDates(query: string, today: string): TypedDate[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [
    { date: today, word: 'today' },
    { date: addDays(today, 1), word: 'tomorrow' },
  ];
  const words = WORDS.filter(([word]) => word.startsWith(q)).map(([word, by]) => ({ date: addDays(today, by), word }));
  if (words.length > 0) return words;
  const year = today.slice(0, 4);
  const day = (y: string, m: number, d: string) => `${y}-${String(m).padStart(2, '0')}-${d.padStart(2, '0')}`;
  let date: string | null = null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q);
  const dayMonth = /^(\d{1,2})\s+([a-z]+)(?:,?\s+(\d{4}))?$/.exec(q);
  const monthDay = /^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/.exec(q);
  if (iso) date = q;
  else if (dayMonth && monthNamed(dayMonth[2])) date = day(dayMonth[3] ?? year, monthNamed(dayMonth[2]), dayMonth[1]);
  else if (monthDay && monthNamed(monthDay[1])) date = day(monthDay[3] ?? year, monthNamed(monthDay[1]), monthDay[2]);
  return date && isDay(date) ? [{ date }] : [];
}

/**
 * The pages matching a query: names starting with it, then a word of the
 * name, then its folder. Never the page itself; the first pages when empty.
 */
export function rankPages(pages: PageRef[], query: string, here: string | null, limit = 8): PageRef[] {
  const q = query.trim().toLowerCase();
  const rank = (page: PageRef) => {
    const name = page.name.toLowerCase();
    if (q === '' || name.startsWith(q)) return 0;
    if (name.split(/\s+/).some((word) => word.startsWith(q))) return 1;
    if (page.path.slice(0, Math.max(0, page.path.lastIndexOf('/'))).toLowerCase().includes(q)) return 2;
    return 3;
  };
  return pages
    .filter((page) => page.path !== here)
    .map((page, i) => ({ page, i, rank: rank(page) }))
    .filter((p) => p.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map((p) => p.page);
}

type Open = { from: number; query: string; active: number; items: MentionItem[] } | null;

export const mentionKey = new PluginKey<{ open: Open; dismissedAt: number | null }>('mention');

/** `@` or `[[` and what is typed after it, at a line's start or after a space, outside code. */
function typed(state: EditorState): { from: number; query: string } | null {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const match = /(?:^|\s)(@|\[\[)((?:[^\s@[\]][^@[\]\n]{0,39})?)$/.exec(before);
  return match ? { from: $from.pos - match[1].length - match[2].length, query: match[2] } : null;
}

function itemsFor(query: string, source: ReturnType<MentionSource>): MentionItem[] {
  const dates: MentionItem[] = typedDates(query, todayDay()).map((d) => ({ ...d, kind: 'date' }));
  if (source.here === null || !source.pages) return dates;
  return [...dates, ...rankPages(source.pages, query, source.here).map((p): MentionItem => ({ kind: 'page', name: p.name, path: p.path }))];
}

function choose(view: EditorView, open: NonNullable<Open>, item: MentionItem, here: string | null) {
  const { schema } = view.state;
  const to = view.state.selection.from;
  const tr = view.state.tr;
  if (item.kind === 'date') tr.replaceWith(open.from, to, schema.nodes.date.create(dateAttrs(item.date)));
  else if (here !== null) tr.replaceWith(open.from, to, schema.text(item.name, [schema.marks.link.create({ href: linkTo(here, item.path, '') })]));
  view.dispatch(tr.setMeta(mentionKey, { close: true }).scrollIntoView());
}

/**
 * The `@` menu; `report` hears what to show, or null when it closes, and
 * `wantPages` asks the app to read the Space's pages each time it opens.
 */
export function mentionPlugin(report: (info: MentionInfo | null) => void, source: MentionSource, wantPages: () => void): Plugin {
  let last: string | null = null;
  let asked: number | null = null;
  return new Plugin({
    key: mentionKey,
    state: {
      init: () => ({ open: null as Open, dismissedAt: null as number | null }),
      apply(tr, prev, _old, state) {
        const meta = tr.getMeta(mentionKey) as { close?: boolean; dismiss?: boolean; active?: number } | undefined;
        const now = typed(state);
        if (!now || meta?.close) return { open: null, dismissedAt: now ? prev.dismissedAt : null };
        if (meta?.dismiss || prev.dismissedAt === now.from) return { open: null, dismissedAt: now.from };
        const items = itemsFor(now.query, source());
        if (items.length === 0) return { open: null, dismissedAt: null };
        const kept = prev.open && prev.open.from === now.from ? prev.open.active : 0;
        const active = Math.max(0, Math.min(items.length - 1, meta?.active ?? kept));
        return { open: { ...now, active, items }, dismissedAt: null };
      },
    },
    props: {
      handleKeyDown(view, event) {
        const open = mentionKey.getState(view.state)?.open;
        if (!open) return false;
        const move = (by: number) => view.dispatch(view.state.tr.setMeta(mentionKey, { active: (open.active + by + open.items.length) % open.items.length }));
        if (event.key === 'ArrowDown') move(1);
        else if (event.key === 'ArrowUp') move(-1);
        else if (event.key === 'Enter' || event.key === 'Tab') choose(view, open, open.items[open.active], source().here);
        else if (event.key === 'Escape') view.dispatch(view.state.tr.setMeta(mentionKey, { dismiss: true }));
        else return false;
        return true;
      },
    },
    view: (view) => {
      const update = (view: EditorView) => {
        const now = typed(view.state);
        if (!now) asked = null;
        else if (asked !== now.from && source().here !== null) {
          asked = now.from;
          wantPages();
        }
        const open = mentionKey.getState(view.state)?.open ?? null;
        let info: MentionInfo | null = null;
        if (open) {
          let at = { left: 0, bottom: 0 };
          try {
            const coords = view.coordsAtPos(open.from);
            at = { left: coords.left, bottom: coords.bottom };
          } catch {
            // No layout (tests): the list still reports its items.
          }
          info = { items: open.items, active: open.active, at };
        }
        const key = info ? `${open!.from}:${open!.query}:${open!.active}:${open!.items.length}:${info.at.left}:${info.at.bottom}` : null;
        if (key !== last) {
          last = key;
          report(info);
        }
      };
      update(view);
      return { update };
    },
  });
}

/** Chooses an item picked with the pointer. */
export function chooseMention(view: EditorView, index: number, here: string | null): void {
  const open = mentionKey.getState(view.state)?.open;
  if (open?.items[index]) choose(view, open, open.items[index], here);
  view.focus();
}
