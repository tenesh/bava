// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { TextSelection, type Command } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import { Slice } from 'prosemirror-model';
import { DocEditor } from './editor';
import { openEditor } from './test-editor';
import { runItem, SLASH_ITEMS } from './slash';
import { readCells, tables } from './table';
import { atTextEnd } from './test-caret';

// jsdom lays nothing out: scrolling to the caret asks a text range for rectangles it has none of.
for (const name of ['getClientRects', 'getBoundingClientRect'] as const) {
  if (typeof Range.prototype[name] !== 'function') {
    Object.defineProperty(Range.prototype, name, { value: name === 'getClientRects' ? () => [] : () => new DOMRect(), configurable: true });
  }
}

// Nor can it say what is under a point, which a press on a cell asks.
if (typeof document.elementFromPoint !== 'function') document.elementFromPoint = () => null;

let editor: DocEditor | null = null;

const TABLE = '| A   | B   |\n|-----|-----|\n| 1   | 2   |\n';

function open(markdown: string) {
  const opened = openEditor(markdown);
  editor = opened.editor;
  return editor.view!;
}

function type(text: string) {
  const view = editor!.view!;
  for (const char of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
  }
}

function key(name: string, shift = false) {
  const view = editor!.view!;
  return view.someProp('handleKeyDown', (f) => f(view, new KeyboardEvent('keydown', { key: name, shiftKey: shift, bubbles: true })));
}

/** Puts the caret in the cell holding `text`. */
function caretIn(text: string) {
  const view = editor!.view!;
  let at = -1;
  view.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text === text) at = pos + node.nodeSize;
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
}

const run = (command: Command) => editor!.run(command);

describe('making a table', () => {
  it('inserts a table with a header row from the / menu, the caret in its first cell', () => {
    open('');
    runItem(editor!.view!, SLASH_ITEMS.find((i) => i.id === 'table')!);
    type('Name');
    expect(editor!.markdown()).toBe('| Name |     |     |\n|------|-----|-----|\n|      |     |     |\n|      |     |     |\n');
  });
});

describe('moving through a table', () => {
  // As a spreadsheet: the cell moved to has its text selected, so typing replaces it.
  it('moves to the next cell with Tab and back with Shift-Tab, adding a row after the last cell', () => {
    open(TABLE);
    caretIn('A');
    key('Tab');
    type('x');
    caretIn('2');
    key('Tab');
    type('3');
    key('Tab', true);
    type('y');
    expect(editor!.markdown()).toBe('| A   | x   |\n|-----|-----|\n| 1   | y   |\n| 3   |     |\n');
  });

  it('breaks the line in a cell on Enter', () => {
    open(TABLE);
    caretIn('1');
    key('Enter');
    type('more');
    expect(editor!.markdown()).toBe('| A         | B   |\n|-----------|-----|\n| 1<br>more | 2   |\n');
  });
});

describe('changing a table', () => {
  it('adds and deletes rows and columns', () => {
    open(TABLE);
    caretIn('1');
    run(tables.rowBelow);
    run(tables.columnRight);
    expect(editor!.markdown()).toBe('| A   |     | B   |\n|-----|-----|-----|\n| 1   |     | 2   |\n|     |     |     |\n');
    caretIn('2');
    run(tables.deleteColumn);
    caretIn('1');
    run(tables.deleteRow);
    expect(editor!.markdown()).toBe('| A   |     |\n|-----|-----|\n|     |     |\n');
  });

  it('deletes the table with its last row or column', () => {
    open(`Before\n\n${TABLE}`);
    caretIn('A');
    run(tables.deleteColumn);
    caretIn('B');
    run(tables.deleteColumn);
    expect(editor!.view!.state.doc.firstChild!.textContent).toBe('Before');
    expect(editor!.markdown()).not.toContain('|');
  });

  it('moves a row and a column', () => {
    open('| A   | B   |\n|-----|-----|\n| 1   | 2   |\n| 3   | 4   |\n');
    caretIn('1');
    run(tables.moveRow(1));
    caretIn('A');
    run(tables.moveColumn(1));
    expect(editor!.markdown()).toBe('| B   | A   |\n|-----|-----|\n| 4   | 3   |\n| 2   | 1   |\n');
  });

  it('merges selected cells, written as HTML, and splits them back into a Markdown table', () => {
    const view = open(TABLE);
    let first = -1;
    let second = -1;
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'table_cell' && first < 0) first = pos;
      else if (node.type.name === 'table_cell') second = pos;
    });
    view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, first, second)));
    expect(editor!.tableState().canMerge).toBe(true);
    run(tables.merge);
    // Nothing is lost: each cell's text follows the last on a new line.
    expect(editor!.markdown()).toContain('<td colspan="2">1<br>2</td>');
    expect(editor!.tableState().canSplit).toBe(true);
    run(tables.split);
    // Merging joined the two cells' text; splitting gives the columns back.
    expect(editor!.markdown()!.startsWith('| A')).toBe(true);
  });

  it('merges a header cell with a body cell', () => {
    const view = open(TABLE);
    const cells: number[] = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'table_header' || node.type.name === 'table_cell') cells.push(pos);
    });
    view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, cells[0], cells[2])));
    run(tables.merge);
    expect(editor!.markdown()).toContain('rowspan="2"');
    expect(editor!.view!.state.doc.textContent).toContain('A');
    expect(editor!.view!.state.doc.textContent).toContain('1');
  });

  it('merges empty cells into one empty cell', () => {
    const view = open('| A   | B   |\n|-----|-----|\n|     |     |\n');
    const cells: number[] = [];
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'table_cell') cells.push(pos);
    });
    view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, cells[0], cells[1])));
    expect(() => run(tables.merge)).not.toThrow();
    expect(editor!.markdown()).toContain('<td colspan="2"></td>');
  });

  it('turns a header row off and back on without touching the header column', () => {
    open(TABLE);
    caretIn('1');
    run(tables.headerColumn);
    run(tables.headerRow);
    expect(editor!.markdown()).toBe('<table>\n<tr><th>A</th><td>B</td></tr>\n<tr><th>1</th><td>2</td></tr>\n</table>\n');
    run(tables.headerColumn);
    expect(editor!.markdown()).toBe('<table>\n<tr><td>A</td><td>B</td></tr>\n<tr><td>1</td><td>2</td></tr>\n</table>\n');
    run(tables.headerRow);
    expect(editor!.markdown()).toBe(TABLE);
  });

  it('turns a header column on, written as HTML', () => {
    open(TABLE);
    caretIn('1');
    run(tables.headerColumn);
    expect(editor!.markdown()).toBe('<table>\n<tr><th>A</th><th>B</th></tr>\n<tr><th>1</th><td>2</td></tr>\n</table>\n');
  });

  it('aligns a whole column, which a Markdown table can hold', () => {
    open(TABLE);
    caretIn('2');
    run(tables.align('center'));
    expect(editor!.markdown()).toBe('| A   | B   |\n|-----|:---:|\n| 1   | 2   |\n');
  });

  it('colours the selected cells, written as HTML', () => {
    open(TABLE);
    caretIn('2');
    run(tables.color('yellow'));
    expect(editor!.markdown()).toBe('<table>\n<tr><th>A</th><th>B</th></tr>\n<tr><td>1</td><td data-background="yellow">2</td></tr>\n</table>\n');
    run(tables.color(null));
    expect(editor!.markdown()).toBe(TABLE);
  });
});

describe('pasting spreadsheet cells', () => {
  it('reads tab-separated rows, quoted cells included', () => {
    expect(readCells('a\tb\n1\t2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(readCells('"one\ntwo"\t"say ""hi"""\nx')).toEqual([
      ['one\ntwo', 'say "hi"'],
      ['x', ''],
    ]);
    expect(readCells('no tabs here')).toBeNull();
  });

  it('makes a table of rows pasted outside one, the first row as its headers', () => {
    open('Before\n');
    const view = editor!.view!;
    view.dispatch(view.state.tr.setSelection(atTextEnd(view.state.doc)));
    editor!.paste('a\tb\n1\t2\n');
    expect(editor!.markdown()).toBe('Before\n\n| a   | b   |\n|-----|-----|\n| 1   | 2   |\n');
  });

  it('fills cells from the caret when pasted inside a table, growing it as needed', () => {
    open(TABLE);
    caretIn('1');
    editor!.paste('x\ty\tz\nw\t\tv\n');
    expect(editor!.markdown()).toBe('| A   | B   |     |\n|-----|-----|-----|\n| x   | y   | z   |\n| w   |     | v   |\n');
  });

  it('takes cells pasted by the webview itself, as from a right-click Paste', () => {
    const view = open('');
    const event = { clipboardData: { getData: (type: string) => (type === 'text/plain' ? 'a\tb\n1\t2' : '') } } as unknown as ClipboardEvent;
    expect(view.someProp('handlePaste', (f) => f(view, event, Slice.empty))).toBe(true);
    expect(editor!.markdown()).toBe('| a   | b   |\n|-----|-----|\n| 1   | 2   |\n');
  });

  it('pastes text with tabs into a code block as code, never as a table', () => {
    const view = open('```go\nx\n```\n');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
    editor!.paste('if x {\n\treturn\n}');
    // The code block, and the empty line the page ends with: no table.
    expect(editor!.view!.state.doc.childCount).toBe(2);
    expect(editor!.view!.state.doc.firstChild!.textContent).toContain('\treturn');
    const event = { clipboardData: { getData: () => '\tindented' } } as unknown as ClipboardEvent;
    expect(view.someProp('handlePaste', (f) => f(view, event, Slice.empty))).toBeFalsy();
  });

  it('grows a table for pasted cells as one step undo takes back', () => {
    open(TABLE);
    caretIn('1');
    editor!.paste('x\ty\tz\nw\t\tv\n');
    editor!.undo();
    expect(editor!.markdown()).toBe(TABLE);
  });

  it('keeps every pasted text that lands on a merged cell', () => {
    const view = open('<table>\n<tr><th>A</th><th>B</th></tr>\n<tr><td colspan="2">m</td></tr>\n</table>\n');
    caretIn('m');
    editor!.paste('X\tY');
    expect(view.state.doc.textContent).toBe('ABXY');
  });

  it('reads a cell with a stray quote as written, and drops trailing empty rows', () => {
    expect(readCells('a\tb\n\n')).toEqual([['a', 'b']]);
    expect(readCells('"a"b\tc')).toEqual([['"a"b', 'c']]);
  });

  it('keeps a line break in a pasted cell', () => {
    open('');
    editor!.paste('"one\ntwo"\tb\n');
    expect(editor!.markdown()).toBe('| one<br>two | b   |\n|------------|-----|\n');
  });
});

/** Selects the cells from the one holding `from` to the one holding `to`. */
function selectCells(from: string, to: string) {
  const view = editor!.view!;
  const cellOf = (text: string) => {
    let at = -1;
    view.state.doc.descendants((node, pos) => {
      if (at < 0 && (node.type.name === 'table_cell' || node.type.name === 'table_header') && node.textContent === text) at = pos;
    });
    return at;
  };
  view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, cellOf(from), cellOf(to))));
}

const GRID = '| A   | B   | C   |\n|-----|-----|-----|\n| 1   | 2   | 3   |\n| 4   | 5   | 6   |\n';

describe('what the table menu offers', () => {
  it('offers merging only for two or more cells of one kind', () => {
    open(GRID);
    caretIn('1');
    expect(editor!.tableState().canMerge).toBe(false);
    selectCells('1', '5');
    expect(editor!.tableState().canMerge).toBe(true);
    selectCells('B', '2');
    expect(editor!.tableState().canMerge).toBe(false);
  });

  it('offers splitting only on a merged cell', () => {
    open(GRID);
    caretIn('1');
    expect(editor!.tableState().canSplit).toBe(false);
    selectCells('1', '2');
    run(tables.merge);
    expect(editor!.tableState().canSplit).toBe(true);
  });

  it('offers moving a row or a column only where it can go, one at a time', () => {
    open(GRID);
    caretIn('1');
    expect(editor!.tableState()).toMatchObject({ canMoveRowUp: true, canMoveRowDown: true, canMoveColumnLeft: false, canMoveColumnRight: true });
    caretIn('A');
    expect(editor!.tableState()).toMatchObject({ canMoveRowUp: false });
    caretIn('6');
    expect(editor!.tableState()).toMatchObject({ canMoveRowDown: false, canMoveColumnRight: false });
    selectCells('1', '5');
    expect(editor!.tableState()).toMatchObject({ canMoveRowUp: false, canMoveRowDown: false, canMoveColumnLeft: false, canMoveColumnRight: false });
  });

  it('says whether the header row and header column are on', () => {
    open(GRID);
    caretIn('1');
    expect(editor!.tableState()).toMatchObject({ headerRow: true, headerColumn: false });
    run(tables.headerColumn);
    expect(editor!.tableState()).toMatchObject({ headerRow: true, headerColumn: true });
  });
});

describe('a right-click on selected cells', () => {
  it('keeps the cells selected for the menu, even when the webview selects a word under the pointer', () => {
    const onTableMenu = vi.fn();
    const opened = openEditor(GRID, { onTableMenu });
    editor = opened.editor;
    const { host } = opened;
    selectCells('1', '5');
    const view = editor.view!;
    const cell = [...host.querySelectorAll('td')].find((td) => td.textContent === '5')!;
    cell.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true, cancelable: true }));
    // What WebKit on macOS does next: the word under the pointer becomes the selection.
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, view.posAtDOM(cell, 0) + 1)));
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(view.state.selection instanceof CellSelection).toBe(true);
    expect(editor.tableState().canMerge).toBe(true);
    expect(onTableMenu).toHaveBeenCalled();
  });

  it('puts the caret in a cell right-clicked outside the selection', () => {
    const onTableMenu = vi.fn();
    const opened = openEditor(GRID, { onTableMenu });
    editor = opened.editor;
    const { host } = opened;
    selectCells('1', '2');
    const cell = [...host.querySelectorAll('td')].find((td) => td.textContent === '6')!;
    cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(editor.view!.state.selection.$from.parent.textContent).toBe('6');
  });
});

describe('inside a cell', () => {
  it('shows no hint to type /, and the / menu offers only what goes in a line', () => {
    const onSlash = vi.fn();
    const opened = openEditor('| A   | B   |\n|-----|-----|\n|     | 2   |\n', { onSlash });
    editor = opened.editor;
    const { host } = opened;
    const view = editor.view!;
    let empty = -1;
    view.state.doc.descendants((node, pos) => {
      if (empty < 0 && node.type.name === 'table_cell' && node.textContent === '') empty = pos + 2;
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, empty)));
    expect(host.querySelector('.is-empty')).toBeNull();
    type('/');
    const info = onSlash.mock.calls.at(-1)![0];
    expect(info.items.map((i: { group: string }) => i.group)).toEqual(['inline', 'inline', 'inline']);
  });
});

describe('cells selected by dragging', () => {
  it('stay selected when the browser reads back its own selection after the drag, until the next click or key', () => {
    const view = open(GRID);
    selectCells('1', '5');
    view.dom.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const $inside = view.state.doc.resolve(view.state.selection.from + 2);
    const read = () => view.someProp('createSelectionBetween', (f) => f(view, $inside, $inside));
    expect(read()).toBe(view.state.selection);
    view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(read()).toBeFalsy();
  });
});

describe('the table menu, next to merged cells and after a right-click', () => {
  it('offers moving only where the table can actually move it', () => {
    // A row cannot move through a cell merged down the rows; a column can pass it.
    open(GRID);
    selectCells('1', '4');
    run(tables.merge);
    caretIn('5');
    expect(editor!.tableState()).toMatchObject({ canMoveRowUp: false, canMoveColumnLeft: true });
    // Next to a cell merged across columns, the menu offers exactly what the table allows.
    open(GRID);
    selectCells('2', '3');
    run(tables.merge);
    caretIn('5');
    const state = editor!.view!.state;
    expect(editor!.tableState()).toMatchObject({
      canMoveColumnLeft: tables.moveColumn(-1)(state),
      canMoveColumnRight: tables.moveColumn(1)(state),
      canMoveRowUp: tables.moveRow(-1)(state),
    });
    expect(editor!.tableState().canMoveColumnRight).toBe(false);
  });

  it('forgets cells held for a right-click that did not open the menu', () => {
    const onTableMenu = vi.fn();
    const opened = openEditor(GRID, { onTableMenu });
    editor = opened.editor;
    const { host } = opened;
    selectCells('1', '5');
    const cellWith = (text: string) => [...host.querySelectorAll('td')].find((td) => td.textContent === text)!;
    cellWith('5').dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true, cancelable: true }));
    // The menu opened elsewhere, off the cells; later the caret is put in 6 and 6 right-clicked.
    host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    caretIn('6');
    cellWith('6').dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true, cancelable: true }));
    cellWith('6').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(editor.view!.state.selection.$from.parent.textContent).toBe('6');
  });

  it('keeps the cells through a Control-click, the Mac right-click', () => {
    const platform = Object.getOwnPropertyDescriptor(navigator, 'platform');
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    try {
      const opened = openEditor(GRID, { onTableMenu: vi.fn() });
      editor = opened.editor;
      const { host } = opened;
      selectCells('1', '5');
      const cell = [...host.querySelectorAll('td')].find((td) => td.textContent === '5')!;
      const down = new MouseEvent('mousedown', { button: 0, ctrlKey: true, bubbles: true, cancelable: true });
      cell.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(true);
      cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      expect(editor.view!.state.selection instanceof CellSelection).toBe(true);
    } finally {
      if (platform) Object.defineProperty(navigator, 'platform', platform);
      else delete (navigator as { platform?: string }).platform;
    }
  });

  it('lets go of dragged cells on the next pointer press', () => {
    const view = open(GRID);
    selectCells('1', '5');
    view.dom.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const $inside = view.state.doc.resolve(view.state.selection.from + 2);
    const read = () => view.someProp('createSelectionBetween', (f) => f(view, $inside, $inside));
    expect(read()).toBe(view.state.selection);
    view.dom.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(read()).toBeFalsy();
  });

  it('shows no hint and a line-only / menu after Tab, in body and header cells alike', () => {
    const onSlash = vi.fn();
    const opened = openEditor('| A   |     |\n|-----|-----|\n| 1   |     |\n', { onSlash });
    editor = opened.editor;
    const { host } = opened;
    caretIn('A');
    key('Tab');
    expect(host.querySelector('.is-empty')).toBeNull();
    type('/');
    expect(onSlash.mock.calls.at(-1)![0].items.every((i: { group: string }) => i.group === 'inline')).toBe(true);
  });

  it('counts the cells selected, for the menu to say cell or cells', () => {
    open(GRID);
    selectCells('1', '5');
    expect(editor!.tableState().cells).toBe(4);
    run(tables.merge);
    expect(editor!.tableState().cells).toBe(1);
  });
});

