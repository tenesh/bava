/**
 * Editing tables: moving between cells, rows and columns, merging, headers,
 * alignment and cell colours, widths by dragging a column's edge. The table
 * package (MIT) does the cell selection, spans and resizing; this adds the
 * keys, the commands the menus run, and the `+` edges.
 */
import { Fragment, type Node } from 'prosemirror-model';
import { TextSelection, type Command, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import {
  addColumn,
  addColumnAfter,
  addRow,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  CellSelection,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  isInTable,
  mergeCells,
  moveTableColumn,
  moveTableRow,
  selectedRect,
  setCellAttr,
  splitCell,
  TableMap,
  tableEditing,
  TableView,
  type TableRect,
} from 'prosemirror-tables';
import { t } from '../i18n/t';
import { schema } from './schema';

/** The narrowest a column can be dragged to, in pixels: the `--size-table-cell-min` token. */
function cellMinWidth(): number {
  const token = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue('--size-table-cell-min');
  return Number.parseFloat(token) || 60;
}

const inCell = (state: EditorState) => {
  const { $from } = state.selection;
  return $from.depth >= 1 && ($from.node(-1).type === schema.nodes.table_cell || $from.node(-1).type === schema.nodes.table_header);
};

/** Tab: the next cell, or a new row after the last one. */
const nextCell: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  if (goToNextCell(1)(state, dispatch)) return true;
  if (!dispatch) return true;
  let current = state;
  addRowAfter(current, (tr) => {
    current = current.apply(tr);
    dispatch(tr);
  });
  goToNextCell(1)(current, dispatch);
  return true;
};

/** Shift-Tab: the cell before; at the first cell the caret stays. */
const previousCell: Command = (state, dispatch) => {
  if (!isInTable(state)) return false;
  goToNextCell(-1)(state, dispatch);
  return true;
};

/** Enter in a cell is a new line in that cell: a cell holds one paragraph. */
const breakInCell: Command = (state, dispatch) => {
  if (!inCell(state)) return false;
  dispatch?.(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
  return true;
};

export const tableKeys: Record<string, Command> = {
  Tab: nextCell,
  'Shift-Tab': previousCell,
  Enter: breakInCell,
};

/** Deletes the rows or columns; the table goes with its last one. */
function deleteOrTable(remove: Command, lines: (rect: ReturnType<typeof selectedRect>) => boolean): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false;
    return lines(selectedRect(state)) ? deleteTable(state, dispatch) : remove(state, dispatch);
  };
}

/** Sets an attribute on every cell of the selected columns. */
function setColumnAttr(name: string, value: unknown): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false;
    if (dispatch) {
      const rect = selectedRect(state);
      const tr = state.tr;
      const seen = new Set<number>();
      for (let row = 0; row < rect.map.height; row += 1) {
        for (let col = rect.left; col < rect.right; col += 1) {
          const pos = rect.map.map[row * rect.map.width + col];
          if (seen.has(pos)) continue;
          seen.add(pos);
          const cell = rect.table.nodeAt(pos)!;
          tr.setNodeMarkup(rect.tableStart + pos, undefined, { ...cell.attrs, [name]: value });
        }
      }
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Turns the header row or header column on or off. Each is its own: the
 * corner cell stays a header while either is on.
 */
function toggleHeaders(kind: 'row' | 'column'): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false;
    if (dispatch) {
      const { table, tableStart, map } = selectedRect(state);
      const at = (row: number, col: number) => map.map[row * map.width + col];
      const isHeader = (pos: number) => table.nodeAt(pos)!.type === schema.nodes.table_header;
      const rowOn = Array.from({ length: map.width }, (_, col) => at(0, col)).every(isHeader);
      const columnOn = map.height > 1 && Array.from({ length: map.height - 1 }, (_, row) => at(row + 1, 0)).every(isHeader);
      const header = (row: number, col: number) => {
        const inRow = row === 0 && (kind === 'row' ? !rowOn : rowOn);
        const inColumn = col === 0 && row > 0 && (kind === 'column' ? !columnOn : columnOn);
        const corner = row === 0 && col === 0 && (kind === 'row' ? !rowOn || columnOn : rowOn || !columnOn);
        return inRow || inColumn || corner;
      };
      const tr = state.tr;
      const seen = new Set<number>();
      for (let row = 0; row < map.height; row += 1) {
        for (let col = 0; col < map.width; col += 1) {
          if (row !== 0 && col !== 0) continue;
          const pos = at(row, col);
          if (seen.has(pos)) continue;
          seen.add(pos);
          const cell = table.nodeAt(pos)!;
          const type = header(row, col) ? schema.nodes.table_header : schema.nodes.table_cell;
          if (cell.type !== type) tr.setNodeMarkup(tableStart + pos, type, cell.attrs);
        }
      }
      dispatch(tr);
    }
    return true;
  };
}

/**
 * Merges the selected cells, keeping every cell's text: a cell holds one
 * paragraph, so the texts are joined into the first, each on a new line,
 * before the cells become one.
 */
const mergeKeepingText: Command = (state, dispatch) => {
  const selection = state.selection;
  if (!(selection instanceof CellSelection) || !mergeCells(state)) return false;
  if (!dispatch) return true;
  const cells: { pos: number; node: Node }[] = [];
  selection.forEachCell((node, pos) => cells.push({ node, pos }));
  cells.sort((a, b) => a.pos - b.pos);
  const texts = cells.map((cell) => cell.node.firstChild!.content).filter((content) => content.size > 0);
  const joined =
    texts.length === 0 ? null : texts.reduce((all, content, i) => (i === 0 ? content : all.append(Fragment.from(schema.nodes.hard_break.create())).append(content)));
  const tr = state.tr;
  // From the last cell back, so earlier positions hold.
  for (const cell of [...cells].reverse()) {
    const content = cell === cells[0] && joined ? schema.nodes.paragraph.create(null, joined) : schema.nodes.paragraph.create();
    tr.replaceWith(cell.pos + 1, cell.pos + cell.node.nodeSize - 1, content);
  }
  let current = state.apply(tr);
  const steps = tr;
  mergeCells(current, (merge) => {
    merge.steps.forEach((step) => steps.step(step));
    current = current.apply(merge);
  });
  dispatch(steps.setSelection(current.selection.map(steps.doc, steps.mapping.slice(steps.steps.length))));
  return true;
};

/** Moves the selected row or column by `by`, keeping it within the table. */
function move(kind: 'row' | 'column', by: number): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false;
    const rect = selectedRect(state);
    const from = kind === 'row' ? rect.top : rect.left;
    const to = from + by;
    const count = kind === 'row' ? rect.map.height : rect.map.width;
    if (to < 0 || to >= count) return false;
    return (kind === 'row' ? moveTableRow : moveTableColumn)({ from, to })(state, dispatch);
  };
}

export const tables = {
  /** A three by three table with a header row, in place of an empty line or after the caret's block. */
  insert: ((state, dispatch) => {
    const { $from } = state.selection;
    if (dispatch) {
      const cell = (type: typeof schema.nodes.table_cell) => type.create(null, schema.nodes.paragraph.create());
      const row = (type: typeof schema.nodes.table_cell) => schema.nodes.table_row.create(null, [cell(type), cell(type), cell(type)]);
      const table = schema.nodes.table.create(null, [row(schema.nodes.table_header), row(schema.nodes.table_cell), row(schema.nodes.table_cell)]);
      const empty = $from.depth === 1 && $from.parent.isTextblock && $from.parent.content.size === 0;
      const at = empty ? $from.before(1) : $from.depth === 0 ? $from.pos : $from.after(1);
      const tr = empty ? state.tr.replaceWith(at, $from.after(1), table) : state.tr.insert(at, table);
      // Into the first cell's paragraph: table, row, cell, paragraph.
      dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 4)).scrollIntoView());
    }
    return true;
  }) satisfies Command,
  rowAbove: addRowBefore,
  rowBelow: addRowAfter,
  columnLeft: addColumnBefore,
  columnRight: addColumnAfter,
  deleteRow: deleteOrTable(deleteRow, (rect) => rect.top === 0 && rect.bottom === rect.map.height),
  deleteColumn: deleteOrTable(deleteColumn, (rect) => rect.left === 0 && rect.right === rect.map.width),
  deleteTable,
  moveRow: (by: number) => move('row', by),
  moveColumn: (by: number) => move('column', by),
  merge: mergeKeepingText,
  split: splitCell,
  headerRow: toggleHeaders('row'),
  headerColumn: toggleHeaders('column'),
  /** Alignment is a column's, as a Markdown table holds it. */
  align: (align: 'left' | 'center' | 'right' | null) => setColumnAttr('align', align),
  color: (background: string | null) => setCellAttr('background', background),
};

/** What the table menu can offer where the selection is. */
export function tableState(state: EditorState): { inTable: boolean; canMerge: boolean; canSplit: boolean } {
  const inTable = isInTable(state);
  return {
    inTable,
    canMerge: inTable && state.selection instanceof CellSelection && mergeCells(state),
    canSplit: inTable && splitCell(state),
  };
}

// ---- the table in the page ----------------------------------------------------

/** The table, with `+` edges along its right and bottom that add a column and a row. */
class TableWithEdges extends TableView {
  constructor(node: Node, cellMinWidth: number, view: EditorView) {
    super(node, cellMinWidth);
    const edge = (className: string, label: string, add: Command, last: (map: TableMap) => number) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `table-edge ${className}`;
      button.contentEditable = 'false';
      button.setAttribute('aria-label', label);
      // For the pointer: the keyboard adds rows and columns from the table menu.
      button.tabIndex = -1;
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        if (!view.editable) return;
        const inside = view.posAtDOM(this.table, 0);
        const $inside = view.state.doc.resolve(inside);
        let depth = $inside.depth;
        while (depth > 0 && $inside.node(depth).type !== schema.nodes.table) depth -= 1;
        const table = $inside.node(depth);
        const start = $inside.start(depth);
        const map = TableMap.get(table);
        const cell = start + map.map[last(map)];
        const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cell + 1)));
        view.dispatch(tr);
        add(view.state, view.dispatch);
        view.focus();
      });
      this.dom.append(button);
    };
    edge('table-edge-column', t('table.addColumn'), addColumnAfter, (map) => map.width - 1);
    edge('table-edge-row', t('table.addRow'), addRowAfter, (map) => map.map.length - 1);
  }

  ignoreMutation(record: MutationRecord | { type: 'selection'; target: globalThis.Node }): boolean {
    if (record.target instanceof HTMLElement && record.target.closest('.table-edge')) return true;
    return super.ignoreMutation(record as MutationRecord);
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof HTMLElement && event.target.closest('.table-edge') !== null;
  }
}

/** Cell selection, column resizing and the table's own view. */
export function tablePlugins() {
  return [
    columnResizing({
      cellMinWidth: cellMinWidth(),
      View: TableWithEdges,
    }),
    tableEditing(),
  ];
}

// ---- pasting spreadsheet cells ---------------------------------------------------

/**
 * Tab-separated rows, as Excel, Numbers and Google Sheets copy cells: a cell
 * holding a tab, a line break or a quote is quoted, its quotes doubled. Null
 * for text with no tab, which is text, not cells. Rows are made as wide as
 * the widest.
 */
export function readCells(text: string): string[][] | null {
  if (!text.includes('\t')) return null;
  const rows: string[][] = [[]];
  let at = 0;
  const endsField = (i: number) => i >= text.length || text[i] === '\t' || text[i] === '\n' || text[i] === '\r';
  while (at <= text.length) {
    let cell: string;
    // A quoted cell is quoted whole: its closing quote comes right before a tab, a line's end or the end.
    let close = -1;
    if (text[at] === '"') {
      for (let i = at + 1; i < text.length; i += 1) {
        if (text[i] === '"' && text[i + 1] === '"') i += 1;
        else if (text[i] === '"') {
          close = endsField(i + 1) ? i : -1;
          break;
        }
      }
    }
    if (close >= 0) {
      cell = text.slice(at + 1, close).replace(/""/g, '"');
      at = close + 1;
    } else {
      let end = at;
      while (!endsField(end)) end += 1;
      cell = text.slice(at, end);
      at = end;
    }
    rows.at(-1)!.push(cell);
    if (at >= text.length) break;
    if (text[at] === '\t') {
      at += 1;
      if (at === text.length) rows.at(-1)!.push('');
      continue;
    }
    at += text[at] === '\r' && text[at + 1] === '\n' ? 2 : 1;
    rows.push([]);
  }
  // Rows with nothing in them at the end are the copy's own line ends.
  while (rows.length > 0 && rows.at(-1)!.every((cell) => cell === '')) rows.pop();
  if (rows.length === 0) return null;
  const width = Math.max(...rows.map((row) => row.length));
  return rows.map((row) => [...row, ...Array<string>(width - row.length).fill('')]);
}

/** A cell's paragraph for pasted text, its line breaks kept. */
function cellParagraph(text: string) {
  const parts = text.split('\n').flatMap((line, i) => [...(i > 0 ? [schema.nodes.hard_break.create()] : []), ...(line ? [schema.text(line)] : [])]);
  return schema.nodes.paragraph.create(null, parts);
}

/**
 * Pasted cells: a new table (its first row as headers) outside a table, or
 * filled into the table from the caret's cell, adding rows and columns as
 * the cells need.
 */
export function pasteCells(cells: string[][]): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    if (!isInTable(state)) {
      const row = (texts: string[], header: boolean) =>
        schema.nodes.table_row.create(
          null,
          texts.map((text) => (header ? schema.nodes.table_header : schema.nodes.table_cell).create(null, cellParagraph(text))),
        );
      const table = schema.nodes.table.create(null, cells.map((texts, i) => row(texts, i === 0)));
      const { $from } = state.selection;
      const empty = $from.depth === 1 && $from.parent.isTextblock && $from.parent.content.size === 0;
      const at = empty ? $from.before(1) : $from.depth === 0 ? $from.pos : $from.after(1);
      dispatch((empty ? state.tr.replaceWith(at, $from.after(1), table) : state.tr.insert(at, table)).scrollIntoView());
      return true;
    }
    // Grown and filled in one transaction, so one undo takes it all back. The
    // table package places each change by the document its transaction began
    // with, so each grows a copy of the state and its steps are carried over.
    const tr = state.tr;
    const start = selectedRect(state);
    const top = start.top;
    const left = start.left;
    let current = state;
    let rect: TableRect = start;
    const grow = (change: (sub: import('prosemirror-state').Transaction) => void) => {
      const sub = current.tr;
      change(sub);
      sub.steps.forEach((step) => tr.step(step));
      current = current.apply(sub);
      const table = current.doc.nodeAt(start.tableStart - 1)!;
      rect = { ...rect, table, map: TableMap.get(table) };
    };
    while (rect.map.height < top + cells.length) grow((sub) => addRow(sub, rect, rect.map.height));
    while (rect.map.width < left + cells[0].length) grow((sub) => addColumn(sub, rect, rect.map.width));
    // Where each pasted cell lands; a merged cell can take several, joined line by line.
    const landing = new Map<number, string[]>();
    cells.forEach((texts, r) =>
      texts.forEach((text, c) => {
        const pos = rect.map.map[(top + r) * rect.map.width + left + c];
        landing.set(pos, [...(landing.get(pos) ?? []), text]);
      }),
    );
    // From the end back, so the positions before each change hold.
    for (const [pos, texts] of [...landing].sort((a, b) => b[0] - a[0])) {
      const at = rect.tableStart + pos;
      const cell = tr.doc.nodeAt(at)!;
      tr.replaceWith(at + 1, at + cell.nodeSize - 1, cellParagraph(texts.filter((text) => text !== '').join('\n')));
    }
    dispatch(tr.scrollIntoView());
    return true;
  };
}