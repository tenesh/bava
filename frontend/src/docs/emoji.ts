/**
 * Emoji: found by name after `:` in the page, or picked from the picker, and
 * saved as the character itself. The names (unicode-emoji-json, MIT) load the
 * first time they are wanted; they are part of the app, never fetched.
 */
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export type Emoji = { emoji: string; name: string; group: string };

type Group = { slug: string; emojis: { emoji: string; name: string; emoji_version: string }[] };

/**
 * The newest emoji listed. Emoji draw with the system's own emoji font, and
 * newer ones show as empty boxes where that font is older; 14.0 (2021) is
 * drawn by every current system.
 */
const NEWEST = 14.0;

let all: Emoji[] | null = null;
let loading: Promise<Emoji[]> | null = null;

/** Every emoji, in Unicode's order, with its name and group. */
export function loadEmoji(): Promise<Emoji[]> {
  loading ??= import('unicode-emoji-json/data-by-group.json').then((data) => {
    const groups = (data.default ?? data) as unknown as Group[];
    all = groups.flatMap((group) =>
      group.emojis.filter((e) => Number(e.emoji_version) <= NEWEST).map((e) => ({ emoji: e.emoji, name: e.name, group: group.slug })),
    );
    return all;
  });
  // A load that failed is tried again the next time emoji are wanted.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/** The emoji whose name starts with `query`, then those with a word starting with it, then any containing it. */
export function searchEmoji(emojis: Emoji[], query: string, limit = 8): Emoji[] {
  const q = query.toLowerCase().replace(/[_-]/g, ' ').trim();
  if (q === '') return [];
  const rank = (name: string) => (name.startsWith(q) ? 0 : name.split(' ').some((word) => word.startsWith(q)) ? 1 : name.includes(q) ? 2 : 3);
  return emojis
    .map((emoji, i) => ({ emoji, i, rank: rank(emoji.name) }))
    .filter((e) => e.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map((e) => e.emoji);
}

export type EmojiInfo = {
  items: Emoji[];
  active: number;
  /** Where the `:` sits on screen, to place the list under it. */
  at: { left: number; bottom: number };
};

type EmojiState = { from: number; query: string; active: number; items: Emoji[] } | null;

export const emojiKey = new PluginKey<{ open: EmojiState; dismissedAt: number | null }>('emoji');

/** The `:` and the name typed after it, at a line's start or after a space, outside code. */
function typed(state: EditorState): { from: number; query: string } | null {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const match = /(?:^|\s):([a-z0-9_+-]{2,})$/i.exec(before);
  return match ? { from: $from.pos - match[1].length - 1, query: match[1] } : null;
}

function choose(view: EditorView, open: NonNullable<EmojiState>, emoji: Emoji) {
  const { from } = open;
  view.dispatch(view.state.tr.insertText(emoji.emoji, from, view.state.selection.from).setMeta(emojiKey, { close: true }));
}

/** The `:` suggestions; `report` hears what to show, or null when they close. */
export function emojiPlugin(report: (info: EmojiInfo | null) => void): Plugin {
  let last: string | null = null;
  return new Plugin({
    key: emojiKey,
    state: {
      init: (): { open: EmojiState; dismissedAt: number | null } => ({ open: null, dismissedAt: null }),
      apply(tr, prev, _old, state): { open: EmojiState; dismissedAt: number | null } {
        const meta = tr.getMeta(emojiKey) as { close?: boolean; dismiss?: boolean; active?: number } | undefined;
        const now = typed(state);
        if (!now || meta?.close) return { open: null, dismissedAt: now ? prev.dismissedAt : null };
        if (meta?.dismiss || prev.dismissedAt === now.from) return { open: null, dismissedAt: now.from };
        const items = all ? searchEmoji(all, now.query) : [];
        if (items.length === 0) return { open: null, dismissedAt: null };
        const kept = prev.open && prev.open.from === now.from ? prev.open.active : 0;
        const active = Math.max(0, Math.min(items.length - 1, meta?.active ?? kept));
        return { open: { ...now, active, items }, dismissedAt: null };
      },
    },
    props: {
      handleKeyDown(view, event) {
        const open = emojiKey.getState(view.state)?.open;
        if (!open) return false;
        const move = (by: number) => view.dispatch(view.state.tr.setMeta(emojiKey, { active: (open.active + by + open.items.length) % open.items.length }));
        if (event.key === 'ArrowDown') move(1);
        else if (event.key === 'ArrowUp') move(-1);
        else if (event.key === 'Enter' || event.key === 'Tab') choose(view, open, open.items[open.active]);
        else if (event.key === 'Escape') view.dispatch(view.state.tr.setMeta(emojiKey, { dismiss: true }));
        else return false;
        return true;
      },
    },
    view: (view) => {
      const update = (view: EditorView) => {
        // The names load the first time a `:` asks for them, then the list shows.
        if (!all && typed(view.state)) {
          void loadEmoji().then(() => {
            if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(emojiKey, {}));
          });
        }
        const open = emojiKey.getState(view.state)?.open ?? null;
        let info: EmojiInfo | null = null;
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
        const key = info ? `${open!.from}:${open!.query}:${open!.active}:${info.at.left}:${info.at.bottom}` : null;
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

/** Chooses a suggestion picked with the pointer. */
export function chooseEmoji(view: EditorView, index: number): void {
  const open = emojiKey.getState(view.state)?.open;
  if (open?.items[index]) choose(view, open, open.items[index]);
  view.focus();
}

/** A transaction carrying this asks the app for the emoji picker at the caret. */
export const PICKER = 'bava-emoji-picker';
