import { describe, expect, it } from 'vitest';
import { TABLE_HEADER, TABLE_PAD, TABLE_ROW, rowAt, rowMiddle, tableLayout } from './table-layout';

const table = { type: 'table', name: 'users', rows: 'id int pk\nemail text unique\nteam_id int fk', w: 240 } as const;
const klass = { type: 'class', name: 'User', rows: '+ email: string\n+ save(): bool\n- hash: string', w: 260 } as const;

describe("a table's layout", () => {
  it('puts the name in a header at the left, then a row every row height', () => {
    const layout = tableLayout(table);
    expect(layout.header).toMatchObject({ text: 'users', align: 'left' });
    expect(layout.rows.map((r) => r.y)).toEqual([TABLE_HEADER, TABLE_HEADER + TABLE_ROW, TABLE_HEADER + 2 * TABLE_ROW]);
    expect(layout.divider).toBeNull();
    expect(layout.height).toBeGreaterThanOrEqual(TABLE_HEADER + 3 * TABLE_ROW);
  });

  it('sets the keys at the right edge, the type before them', () => {
    const [id] = tableLayout(table).rows;
    expect(id.cells.name.x).toBeLessThan(id.cells.type.x);
    expect(id.cells.type.align).toBe('right');
    expect(id.cells.keys).toMatchObject({ text: 'PK', align: 'right', x: 240 - 12 });
    expect(id.cells.type.x).toBeLessThan(id.cells.keys!.x - 12);
  });
});

describe("a class's layout", () => {
  it('centres the name, and puts methods below a divider after the fields', () => {
    const layout = tableLayout(klass);
    expect(layout.header).toMatchObject({ text: 'User', align: 'center' });
    expect(layout.rows.map((r) => r.name)).toEqual(['email', 'hash', 'save()']);
    expect(layout.divider).toBeGreaterThan(layout.rows[1].y + TABLE_ROW - 1);
    expect(layout.divider).toBeLessThan(layout.rows[2].y);
    expect(layout.rows[0].cells.marker).toMatchObject({ text: '+' });
  });

  it('is as tall as its rows, however few', () => {
    const empty = tableLayout({ ...klass, rows: '' });
    expect(empty.rows).toEqual([]);
    expect(empty.height).toBeGreaterThan(TABLE_HEADER);
  });
});

describe('rows by place', () => {
  it('names the row at a height, and none over the header', () => {
    expect(rowAt(table, TABLE_HEADER + TABLE_ROW + 5)).toBe('email');
    expect(rowAt(table, 10)).toBeNull();
    expect(rowAt(klass, tableLayout(klass).rows[2].y + 3)).toBe('save()');
  });

  it("gives a row's middle, and none for a row that is not there", () => {
    expect(rowMiddle(table, 'team_id')).toBe(TABLE_HEADER + 2 * TABLE_ROW + TABLE_ROW / 2);
    expect(rowMiddle(table, 'gone')).toBeNull();
  });
});

describe('cells kept apart', () => {
  // Eight units a character, the arithmetic shows.
  const measure = (text: string) => text.length * 8;

  it('makes the keys column as wide as its widest keys, the type ending before it', () => {
    const layout = tableLayout({ type: 'table', name: 't', rows: 'team_id int fk unique\nid int pk', w: 300 }, measure);
    const [team] = layout.rows;
    expect(team.cells.keys!.text).toBe('FK, UNQ');
    expect(team.cells.type.x).toBeLessThanOrEqual(team.cells.keys!.x - measure('FK, UNQ') - TABLE_PAD / 2);
  });

  it('cuts a name that would reach its type short, with an ellipsis', () => {
    const layout = tableLayout({ type: 'table', name: 't', rows: 'a_very_long_column_name_indeed timestamp pk', w: 240 }, measure);
    const [row] = layout.rows;
    expect(row.cells.name.text.endsWith('…')).toBe(true);
    const typeStart = row.cells.type.x - measure(row.cells.type.text);
    expect(row.cells.name.x + measure(row.cells.name.text)).toBeLessThanOrEqual(typeStart);
    // Binding still knows the row by its whole name.
    expect(row.name).toBe('a_very_long_column_name_indeed');
  });
});

// A file edited by hand may leave a key out: it draws as empty, as any
// missing value draws as its default, rather than failing.
describe('a table or class missing its name or rows', () => {
  it('lays out as an empty one', () => {
    const layout = tableLayout({ type: 'table', w: 200 } as never);
    expect(layout.header.text).toBe('');
    expect(layout.rows).toEqual([]);
    expect(tableLayout({ type: 'class', w: 200 } as never).rows).toEqual([]);
  });
});

