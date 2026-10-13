/**
 * The icon picker's state, inside the + panel's Icon category: which tab,
 * what is typed, which icon is highlighted, and what a key does. Sets load
 * the first time their tab opens; results come a page at a time.
 */
import { GRID_COLUMNS } from './insert.svelte';
import { ICON_RESULTS, searchIcons } from '../canvas/icons/search';
import type { BundledSet, IconEntry } from '../canvas/icons/sets';

export const ICON_TABS = ['general', 'logos', 'custom'] as const;
export type IconTab = (typeof ICON_TABS)[number];

/** The bundled sets a tab shows; Custom shows the user's library. */
const TAB_SETS: Record<Exclude<IconTab, 'custom'>, BundledSet[]> = {
  general: ['line', 'solid'],
  logos: ['logo'],
};

export type IconPickerOutcome = { type: 'none' } | { type: 'up' } | { type: 'icon'; icon: string };
export type IconPickerStatus = 'loading' | 'ready' | 'failed';

const NONE: IconPickerOutcome = { type: 'none' };

type Options = {
  load: (set: BundledSet) => Promise<IconEntry[]>;
  /** The custom library as last read, or null while it is being read. */
  custom: () => IconEntry[] | null;
};

export function createIconPicker({ load, custom }: Options) {
  let tab = $state.raw<IconTab>('general');
  let query = $state.raw('');
  let highlighted = $state.raw(0);
  let limit = $state.raw(ICON_RESULTS);
  /** A tab's icons, once its sets have loaded; a failed load is remembered until the tab opens again. */
  let icons = $state.raw<Partial<Record<IconTab, IconEntry[] | 'failed'>>>({});

  function open(next: IconTab) {
    if (next === 'custom') {
      const library = custom();
      icons = { ...icons, custom: library ?? undefined };
      return;
    }
    const known = icons[next];
    if (known && known !== 'failed') return;
    icons = { ...icons, [next]: undefined };
    Promise.all(TAB_SETS[next].map(load)).then(
      (sets) => (icons = { ...icons, [next]: sets.flat() }),
      () => (icons = { ...icons, [next]: 'failed' }),
    );
  }

  open('general');

  const shown = $derived(icons[tab]);
  const status = $derived<IconPickerStatus>(shown === 'failed' ? 'failed' : shown ? 'ready' : 'loading');
  const results = $derived(Array.isArray(shown) ? searchIcons(shown, query, limit) : []);

  function move(by: number) {
    if (results.length === 0) return;
    highlighted = Math.min(results.length - 1, Math.max(0, highlighted + by));
  }

  function choose(index: number): IconPickerOutcome {
    const icon = results[index];
    return icon ? { type: 'icon', icon: `${icon.set}/${icon.name}` } : NONE;
  }

  return {
    get tab() {
      return tab;
    },
    get query() {
      return query;
    },
    get highlighted() {
      return highlighted;
    },
    get status() {
      return status;
    },
    get results() {
      return results;
    },
    get highlightedIcon(): IconEntry | undefined {
      return results[highlighted];
    },

    setTab(next: IconTab) {
      tab = next;
      highlighted = 0;
      limit = ICON_RESULTS;
      open(next);
    },

    setQuery(value: string) {
      query = value;
      highlighted = 0;
      limit = ICON_RESULTS;
    },

    highlight(index: number) {
      if (index >= 0 && index < results.length) highlighted = index;
    },

    /** The next page of results, when the grid is scrolled to its end. */
    more() {
      limit += ICON_RESULTS;
    },

    choose,

    /** Start over: General, nothing typed, the first page. */
    reset() {
      tab = 'general';
      query = '';
      highlighted = 0;
      limit = ICON_RESULTS;
      open('general');
    },

    /** What a key pressed in the picker does. */
    press(key: string): IconPickerOutcome {
      switch (key) {
        case 'ArrowDown':
          move(GRID_COLUMNS);
          return NONE;
        case 'ArrowUp':
          move(-GRID_COLUMNS);
          return NONE;
        // With words typed, left and right belong to the caret.
        case 'ArrowRight':
          if (query === '') move(1);
          return NONE;
        case 'ArrowLeft':
          if (query === '') move(-1);
          return NONE;
        case 'Enter':
          return choose(highlighted);
        case 'Backspace':
          return query === '' ? { type: 'up' } : NONE;
        case 'Escape':
          if (query !== '') {
            query = '';
            highlighted = 0;
            limit = ICON_RESULTS;
            return NONE;
          }
          return { type: 'up' };
        default:
          return NONE;
      }
    },
  };
}

export type IconPickerState = ReturnType<typeof createIconPicker>;
