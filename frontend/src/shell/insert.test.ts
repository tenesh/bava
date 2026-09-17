import { describe, expect, it } from 'vitest';
import { createInsert, GRID_COLUMNS } from './insert.svelte';

describe('insert panel state', () => {
  it('starts at all categories with the first highlighted', () => {
    const insert = createInsert();
    expect(insert.category).toBeNull();
    expect(insert.entries.map((e) => e.id)).toEqual(['shape']);
    expect(insert.entries[0].kind).toBe('category');
    expect(insert.highlighted).toBe(0);
  });

  it('opens a category on Enter, and lists its items', () => {
    const insert = createInsert();
    expect(insert.press('Enter')).toEqual({ type: 'none' });
    expect(insert.category?.id).toBe('shape');
    expect(insert.entries.map((e) => e.id)).toEqual([
      'rect', 'ellipse', 'diamond', 'cylinder', 'hexagon', 'parallelogram', 'document', 'person', 'cloud',
    ]);
  });

  it('chooses an item on Enter', () => {
    const insert = createInsert();
    insert.press('Enter');
    insert.press('ArrowRight');
    insert.press('ArrowRight');
    expect(insert.highlightedEntry?.id).toBe('diamond');
    expect(insert.press('Enter')).toEqual({ type: 'choose', tool: 'diamond' });
  });

  it('moves by a row in the grid with up and down', () => {
    const insert = createInsert();
    insert.press('Enter');
    insert.press('ArrowDown');
    expect(insert.highlighted).toBe(GRID_COLUMNS);
    insert.press('ArrowUp');
    expect(insert.highlighted).toBe(0);
  });

  it('searches every category by name', () => {
    const insert = createInsert();
    insert.setQuery('cyl');
    expect(insert.entries.map((e) => e.id)).toEqual(['cylinder']);
    expect(insert.press('Enter')).toEqual({ type: 'choose', tool: 'cylinder' });
  });

  it('goes up with Escape inside a category, then closes', () => {
    const insert = createInsert();
    insert.press('Enter');
    expect(insert.press('Escape')).toEqual({ type: 'none' });
    expect(insert.category).toBeNull();
    expect(insert.press('Escape')).toEqual({ type: 'close' });
  });

  it('goes up with Backspace on an empty query', () => {
    const insert = createInsert();
    insert.press('Enter');
    insert.press('Backspace');
    expect(insert.category).toBeNull();
  });

  it('resets when opened again', () => {
    const insert = createInsert();
    insert.press('Enter');
    insert.setQuery('clo');
    insert.reset();
    expect(insert.category).toBeNull();
    expect(insert.query).toBe('');
  });
});
