/**
 * Where a table's or class's name and rows are drawn, in its own units: one
 * layout for the stage, the SVG export, binding an arrow to a row and the
 * element's height.
 */
import { classRows, tableRows } from './table-rows';

/** The header holding the name, and each row, in scene units. */
export const TABLE_HEADER = 36;
export const TABLE_ROW = 28;
/** The width a table or class is placed at by a click, and the least a drag gives it. */
export const TABLE_START_WIDTH = 240;
export const TABLE_MIN_WIDTH = 80;
/** What a table or class placed by hand starts with: a name and one row to type over. */
export const TABLE_START = {
  table: { name: 'table', rows: 'id int pk' },
  class: { name: 'Class', rows: '+ name: string' },
} as const;

/** Room kept inside the box's sides. */
export const TABLE_PAD = 12;
/** Space after a run of rows: below a table's, either side of a class's divider. */
const SECTION_GAP = 6;
/** Space kept between a row's cells. */
const CELL_GAP = TABLE_PAD / 2;
/**
 * A word's width, in scene units. The stage and the export pass the canvas's
 * own measure; without one, a mono face's advance is assumed, enough for
 * binding and height, which never depend on widths.
 */
export type MeasureWords = (text: string) => number;
const ROUGH_ADVANCE = 7.8;
const rough: MeasureWords = (text) => text.length * ROUGH_ADVANCE;

/** Text cut short with an ellipsis to fit `width`; whole when it fits. */
export function fitText(text: string, width: number, measure: MeasureWords): string {
  if (measure(text) <= width) return text;
  for (let end = text.length - 1; end > 0; end -= 1) {
    const cut = `${text.slice(0, end)}…`;
    if (measure(cut) <= width) return cut;
  }
  return '';
}
/** How far a class member's name sits right of its marker. */
const MARKER_WIDTH = 16;

export type TableLike = { type: string; name: string; rows: string; w: number };

export type Cell = { text: string; x: number; align: 'left' | 'right' };

export type LaidRow = {
  /** The row's name, as an arrow binds to it: a column, or a member without its marker. */
  name: string;
  /** The row's top. */
  y: number;
  cells: { marker?: Cell; name: Cell; type: Cell; keys?: Cell };
};

export type TableLayout = {
  header: { text: string; align: 'left' | 'center'; height: number };
  rows: LaidRow[];
  /** A class's divider between fields and methods, its height; null for a table. */
  divider: number | null;
  /** The height its rows need. */
  height: number;
};

export function tableLayout(given: TableLike, measure: MeasureWords = rough): TableLayout {
  // A file edited by hand may leave either out: it draws as empty.
  const element = { ...given, name: given.name ?? '', rows: given.rows ?? '' };
  const right = element.w - TABLE_PAD;
  // A name runs up to its type, the gap between, and is cut short there.
  const name = (text: string, x: number, typeText: string, typeRight: number): Cell => {
    const typeStart = typeRight - (typeText ? measure(typeText) + CELL_GAP : 0);
    return { text: fitText(text, Math.max(0, typeStart - x), measure), x, align: 'left' };
  };
  if (element.type === 'class') {
    const { fields, methods } = classRows(element.rows);
    let y = TABLE_HEADER;
    const place = (member: { marker: string; name: string; type: string }): LaidRow => {
      const row: LaidRow = {
        name: member.name,
        y,
        cells: {
          marker: { text: member.marker, x: TABLE_PAD, align: 'left' },
          name: name(member.name, TABLE_PAD + MARKER_WIDTH, member.type, right),
          type: { text: member.type, x: right, align: 'right' },
        },
      };
      y += TABLE_ROW;
      return row;
    };
    const rows = fields.map(place);
    y += SECTION_GAP;
    const divider = y;
    y += SECTION_GAP;
    rows.push(...methods.map(place));
    return { header: { text: element.name, align: 'center', height: TABLE_HEADER }, rows, divider, height: y + SECTION_GAP };
  }
  const read = tableRows(element.rows);
  // The keys column is as wide as its widest keys; the type ends before it.
  const keysWidth = Math.max(0, ...read.map((row) => (row.keys.length ? measure(row.keys.join(', ')) : 0)));
  const typeRight = keysWidth > 0 ? right - keysWidth - CELL_GAP : right;
  const rows = read.map((row, i): LaidRow => ({
    name: row.name,
    y: TABLE_HEADER + i * TABLE_ROW,
    cells: {
      name: name(row.name, TABLE_PAD, row.type, typeRight),
      type: { text: row.type, x: typeRight, align: 'right' },
      keys: { text: row.keys.join(', '), x: right, align: 'right' },
    },
  }));
  return {
    header: { text: element.name, align: 'left', height: TABLE_HEADER },
    rows,
    divider: null,
    height: TABLE_HEADER + rows.length * TABLE_ROW + SECTION_GAP,
  };
}

/** The row at a height in the element's own units; null over the header or a gap. */
export function rowAt(element: TableLike, y: number): string | null {
  return tableLayout(element).rows.find((row) => y >= row.y && y < row.y + TABLE_ROW)?.name ?? null;
}

/** A row's middle, in the element's own units; null when it is not there. */
export function rowMiddle(element: TableLike, name: string): number | null {
  const row = tableLayout(element).rows.find((r) => r.name === name);
  return row ? row.y + TABLE_ROW / 2 : null;
}
