/**
 * The insert panel's state: search, category, highlight, and what a key does.
 *
 * Only categories that work are listed (canvas-toolbar.md): today, Shape.
 * Kept out of markup so navigation, which is easy to get subtly wrong, is
 * tested directly.
 */
import type { MessageKey } from '../i18n/messages';
import { t } from '../i18n/t';
import type { IconId } from '../components/tool-icons';
import type { ToolId } from '../canvas/tools.svelte';

/** Tiles per row in a category's grid; up and down move by a row. */
export const GRID_COLUMNS = 5;

export type InsertItem = { kind: 'item'; id: ToolId; labelKey: MessageKey; icon: IconId };
export type InsertCategory = {
  kind: 'category';
  id: string;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  icon: IconId;
  items: InsertItem[];
};
export type InsertEntry = InsertItem | InsertCategory;

const shape = (id: ToolId & IconId, labelKey: MessageKey): InsertItem => ({ kind: 'item', id, labelKey, icon: id });

export const CATEGORIES: InsertCategory[] = [
  {
    kind: 'category',
    id: 'shape',
    labelKey: 'insert.shape',
    descriptionKey: 'insert.shapeDescription',
    icon: 'shapes',
    items: [
      shape('rect', 'tool.rect'),
      shape('ellipse', 'tool.ellipse'),
      shape('diamond', 'tool.diamond'),
      shape('cylinder', 'tool.cylinder'),
      shape('hexagon', 'tool.hexagon'),
      shape('parallelogram', 'tool.parallelogram'),
      shape('document', 'tool.document'),
      shape('person', 'tool.person'),
      shape('cloud', 'tool.cloud'),
    ],
  },
];

export type InsertOutcome = { type: 'none' } | { type: 'close' } | { type: 'choose'; tool: ToolId };

const NONE: InsertOutcome = { type: 'none' };

export function createInsert() {
  let query = $state.raw('');
  let category = $state.raw<InsertCategory | null>(null);
  let highlighted = $state.raw(0);

  const entries = $derived.by((): InsertEntry[] => {
    const needle = query.trim().toLowerCase();
    if (needle) {
      return CATEGORIES.flatMap((c) => c.items).filter((item) => t(item.labelKey).toLowerCase().includes(needle));
    }
    return category ? category.items : CATEGORIES;
  });

  /** Whether the entries show as a grid of tiles rather than rows. */
  const grid = $derived(query.trim() !== '' || category !== null);

  function move(by: number) {
    const count = entries.length;
    if (count === 0) return;
    highlighted = Math.min(count - 1, Math.max(0, highlighted + by));
  }

  function choose(index: number): InsertOutcome {
    const entry = entries[index];
    if (!entry) return NONE;
    if (entry.kind === 'category') {
      category = entry;
      highlighted = 0;
      return NONE;
    }
    return { type: 'choose', tool: entry.id };
  }

  function up() {
    category = null;
    highlighted = 0;
  }

  return {
    get query() {
      return query;
    },
    get category() {
      return category;
    },
    get entries() {
      return entries;
    },
    get grid() {
      return grid;
    },
    get highlighted() {
      return highlighted;
    },
    get highlightedEntry(): InsertEntry | undefined {
      return entries[highlighted];
    },

    setQuery(value: string) {
      query = value;
      highlighted = 0;
    },

    highlight(index: number) {
      if (index >= 0 && index < entries.length) highlighted = index;
    },

    choose,

    /** Start over: all categories, no search. */
    reset() {
      query = '';
      category = null;
      highlighted = 0;
    },

    /** What a key pressed in the panel does. */
    press(key: string): InsertOutcome {
      switch (key) {
        case 'ArrowDown':
          move(grid ? GRID_COLUMNS : 1);
          return NONE;
        case 'ArrowUp':
          move(grid ? -GRID_COLUMNS : -1);
          return NONE;
        // With a search typed, left and right belong to the caret.
        case 'ArrowRight':
          if (grid && query === '') move(1);
          return NONE;
        case 'ArrowLeft':
          if (grid && query === '') move(-1);
          return NONE;
        case 'Enter':
          return choose(highlighted);
        case 'Backspace':
          if (query === '' && category) up();
          return NONE;
        case 'Escape':
          if (query !== '') {
            query = '';
            highlighted = 0;
            return NONE;
          }
          if (category) {
            up();
            return NONE;
          }
          return { type: 'close' };
        default:
          return NONE;
      }
    },
  };
}

export type InsertState = ReturnType<typeof createInsert>;
