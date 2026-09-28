// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextSelection, type Command } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import { Slice } from 'prosemirror-model';
import { DocEditor } from './editor';
import { runItem, SLASH_ITEMS } from './slash';
import { readCells, tables } from './table';

// jsdom lays nothing out: scrolling to the caret asks a text range for rectangles it has none of.
for (const name of ['getClientRects', 'getBoundingClientRect'] as const) {
  if (typeof Range.prototype[name] !== 'function') {
    Object.defineProperty(Range.prototype, name, { value: name === 'getClientRects' ? () => [] : () => new DOMRect(), configurable: true });
  }
}

let editor: DocEditor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

const TABLE = '| A   | B   |\n|-----|-----|\n| 1   | 2   |\n';

function open(markdown: string) {
  const host = document.createElement('div');
  document.body.append(host);
  editor = new DocEditor();
  editor.mount(host, { onChange: vi.fn() });
  editor.setPage(markdown);
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
    view.dispatch(view.state.tr.setSelection(TextSelection.atEnd(view.state.doc)));
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
    expect(editor!.view!.state.doc.childCount).toBe(1);
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
