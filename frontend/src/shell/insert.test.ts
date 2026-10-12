import { describe, expect, it } from 'vitest';
import { createInsert, GRID_COLUMNS } from './insert.svelte';
import { t } from '../i18n/t';

describe('insert panel state', () => {
  it('starts at all categories with the first highlighted', () => {
    const insert = createInsert();
    expect(insert.category).toBeNull();
    // Categories, then the tools that are not shapes, then what is not a tool.
    expect(insert.entries.map((e) => e.id)).toEqual(['shape', 'diagram', 'code', 'picture']);
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

// A picture is picked from the files on the computer.
describe('inserting a picture', () => {
  it('is found by name and chosen as a command', () => {
    const insert = createInsert();
    insert.setQuery('picture');
    expect(insert.entries.map((entry) => entry.id)).toEqual(['picture']);
    expect(insert.choose(0)).toEqual({ type: 'command', id: 'picture' });
  });
});

// Not every insert is a tool: a D2 diagram is written as code and arrives whole.
describe('inserting a D2 diagram', () => {
  it('is offered in the Diagram category, named as such', () => {
    const insert = createInsert();
    insert.choose(insert.entries.findIndex((e) => e.id === 'diagram'));
    expect(insert.category && t(insert.category.labelKey)).toBe('Diagram');
    const entry = insert.entries.find((e) => e.id === 'd2Diagram');
    expect(entry && t(entry.labelKey)).toBe('D2 diagram');
    expect(insert.choose(insert.entries.indexOf(entry!))).toEqual({ type: 'command', id: 'd2Diagram' });
  });

  it('is found by searching for it, by its name or its language', () => {
    const insert = createInsert();
    for (const query of ['diagram', 'd2']) {
      insert.setQuery(query);
      expect(insert.entries.map((entry) => entry.id)).toEqual(['d2Diagram']);
    }
  });

  it('asks for the dialog rather than a tool', () => {
    const insert = createInsert();
    insert.setQuery('d2');
    expect(insert.choose(0)).toEqual({ type: 'command', id: 'd2Diagram' });
  });
});

describe('a table or class from the Diagram category', () => {
  it('is offered beside the D2 diagram, and chosen as its tool', () => {
    const insert = createInsert();
    insert.choose(insert.entries.findIndex((e) => e.id === 'diagram'));
    expect(insert.entries.map((e) => [e.id, t(e.labelKey)])).toEqual([
      ['d2Diagram', 'D2 diagram'],
      ['table', 'SQL table'],
      ['class', 'UML class'],
    ]);
    expect(insert.choose(1)).toEqual({ type: 'choose', tool: 'table' });
  });

  it('is found by searching', () => {
    const insert = createInsert();
    insert.setQuery('uml');
    expect(insert.entries.map((e) => e.id)).toEqual(['class']);
  });
});

