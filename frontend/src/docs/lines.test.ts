import { describe, expect, it } from 'vitest';
import { AllSelection, EditorState, NodeSelection, TextSelection } from 'prosemirror-state';
import { GapCursor } from 'prosemirror-gapcursor';
import { CellSelection } from 'prosemirror-tables';
import type { Node } from 'prosemirror-model';
import { parsePage, writePage } from './markdown';
import { addBlock, endsWithALine } from './lines';

const CARET = '‸';

/** A page read with the caret where `‸` is written. */
function stateOf(markdown: string): EditorState {
  const doc = parsePage(markdown).doc;
  let at = -1;
  doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text!.includes(CARET)) at = pos + node.text!.indexOf(CARET);
  });
  const state = EditorState.create({ doc });
  if (at < 0) return state;
  const tr = state.tr.delete(at, at + 1);
  return state.apply(tr.setSelection(TextSelection.create(tr.doc, at)));
}

/** The page as an outline, one block a line, the caret as `|`. */
function outline(state: EditorState): string[] {
  const lines: string[] = [];
  const caret = state.selection.empty ? state.selection.from : -1;
  const walk = (node: Node, start: number, depth: number) => {
    node.forEach((child, offset) => {
      const pos = start + offset;
      const pad = '  '.repeat(depth);
      if (child.isTextblock) {
        let text = child.textContent;
        if (caret >= pos + 1 && caret <= pos + 1 + child.content.size) text = text.slice(0, caret - pos - 1) + '|' + text.slice(caret - pos - 1);
        lines.push(`${pad}${child.type.name}: ${text}`);
      } else if (child.isLeaf || child.type.name === 'table') {
        lines.push(`${pad}${child.type.name}`);
      } else {
        lines.push(`${pad}${child.type.name}`);
        walk(child, pos + 1, depth + 1);
      }
    });
  };
  walk(state.doc, 0, 0);
  return lines;
}

function press(state: EditorState, side: 'after' | 'before'): EditorState {
  let next = state;
  const done = addBlock(side)(state, (tr) => (next = state.apply(tr)));
  expect(done).toBe(true);
  return next;
}

const cases: { name: string; page: string; side: 'after' | 'before'; want: string[] }[] = [
  { name: 'text on the page', page: 'One‸\n\nTwo\n', side: 'after', want: ['paragraph: One', 'paragraph: |', 'paragraph: Two'] },
  { name: 'before text', page: 'One\n\nTw‸o\n', side: 'before', want: ['paragraph: One', 'paragraph: |', 'paragraph: Two'] },
  { name: 'a heading', page: '## Ti‸tle\n\nText\n', side: 'after', want: ['heading: Title', 'paragraph: |', 'paragraph: Text'] },
  { name: "a list item's text", page: '- A‸\n- B\n', side: 'after', want: ['bullet_list', '  list_item', '    paragraph: A', '  list_item', '    paragraph: |', '  list_item', '    paragraph: B'] },
  { name: 'before a list item', page: '1. A\n2. B‸\n', side: 'before', want: ['ordered_list', '  list_item', '    paragraph: A', '  list_item', '    paragraph: |', '  list_item', '    paragraph: B'] },
  { name: 'a line after an item\'s text', page: '- A\n\n  More‸\n', side: 'after', want: ['bullet_list', '  list_item', '    paragraph: A', '    paragraph: More', '    paragraph: |'] },
  { name: 'a line in a quote', page: '> A‸\n>\n> B\n', side: 'after', want: ['blockquote', '  paragraph: A', '  paragraph: |', '  paragraph: B'] },
  { name: 'a line in a callout', page: '> [!info]\n> A‸\n', side: 'after', want: ['callout', '  paragraph: A', '  paragraph: |'] },
  { name: "a toggle's title", page: '<details>\n<summary>Ti‸tle</summary>\n\nBody.\n\n</details>\n\nNext\n', side: 'after', want: ['toggle', '  toggle_summary: Title', '  paragraph: Body.', 'paragraph: |', 'paragraph: Next'] },
  { name: 'before a toggle', page: 'Intro\n\n<details>\n<summary>Ti‸tle</summary>\n\nBody.\n\n</details>\n', side: 'before', want: ['paragraph: Intro', 'paragraph: |', 'toggle', '  toggle_summary: Title', '  paragraph: Body.'] },
  { name: "a line in a toggle's body", page: '<details>\n<summary>Title</summary>\n\nBo‸dy.\n\n</details>\n', side: 'after', want: ['toggle', '  toggle_summary: Title', '  paragraph: Body.', '  paragraph: |'] },
  { name: 'a code block', page: '```go\nx‸\n```\n\nNext\n', side: 'after', want: ['code_block: x', 'paragraph: |', 'paragraph: Next'] },
  { name: 'before a code block', page: 'Intro\n\n```go\nx‸\n```\n', side: 'before', want: ['paragraph: Intro', 'paragraph: |', 'code_block: x'] },
  { name: 'a table cell', page: '| A‸ |\n|---|\n| B |\n\nNext\n', side: 'after', want: ['table', 'paragraph: |', 'paragraph: Next'] },
  { name: 'before a table', page: 'Intro\n\n| A |\n|---|\n| B‸ |\n', side: 'before', want: ['paragraph: Intro', 'paragraph: |', 'table'] },
  { name: "a line in a footnote's note", page: 'Text.[^1]\n\n[^1]: No‸te.\n', side: 'after', want: ['paragraph: Text.[^1]', 'footnotes', '  footnote', '    paragraph: Note.', '    paragraph: |'] },
  { name: 'a table in a quote', page: '> | A‸ |\n> |---|\n> | B |\n', side: 'after', want: ['blockquote', '  table', '  paragraph: |'] },
];

describe('adding a block before or after the nearest block', () => {
  for (const c of cases) {
    it(c.name, () => {
      expect(outline(press(stateOf(c.page), c.side))).toEqual(c.want);
    });
  }

  it('makes a new to-do unticked, and keeps the kind of list', () => {
    const next = press(stateOf('- [x] Done‸\n'), 'after');
    const list = next.doc.firstChild!;
    expect(list.childCount).toBe(2);
    expect(list.child(1).attrs.checked).toBe(false);
  });

  it('moves an empty last line out of a quote, callout or toggle', () => {
    for (const page of ['> A\n', '> [!info]\n> A\n', '<details>\n<summary>T</summary>\n\nA\n\n</details>\n']) {
      // An empty line after A, the caret on it, then ⌘Enter again.
      const once = press(stateOf(page.replace('A', 'A‸')), 'after');
      const twice = press(once, 'after');
      const lines = outline(twice);
      expect(lines.at(-1), page).toBe('paragraph: |');
      expect(lines.filter((l) => l.trim() === 'paragraph:').length, page).toBe(0);
    }
  });

  it('moves an empty first line out before its container', () => {
    const once = press(stateOf('Intro\n\n> ‸A\n'), 'before');
    expect(outline(once)).toEqual(['paragraph: Intro', 'blockquote', '  paragraph: |', '  paragraph: A']);
    expect(outline(press(once, 'before'))).toEqual(['paragraph: Intro', 'paragraph: |', 'blockquote', '  paragraph: A']);
  });

  it('leaves a list from its empty last item, and each press moves out one level', () => {
    const inCallout = press(stateOf('> [!info]\n> - A‸\n'), 'after');
    expect(outline(inCallout)).toEqual(['callout', '  bullet_list', '    list_item', '      paragraph: A', '    list_item', '      paragraph: |']);
    const outOfList = press(inCallout, 'after');
    expect(outline(outOfList)).toEqual(['callout', '  bullet_list', '    list_item', '      paragraph: A', '  paragraph: |']);
    expect(outline(press(outOfList, 'after'))).toEqual(['callout', '  bullet_list', '    list_item', '      paragraph: A', 'paragraph: |']);
  });

  it('keeps a line in a footnote in its note', () => {
    const once = press(stateOf('Text.[^1]\n\n[^1]: Note‸.\n'), 'after');
    const twice = press(once, 'after');
    expect(outline(twice).slice(-3)).toEqual(['    paragraph: Note.', '    paragraph: ', '    paragraph: |']);
  });

  it('adds around a selected divider, equation or table', () => {
    for (const page of ['A\n\n---\n\nB\n', 'A\n\n$$\nx\n$$\n\nB\n', 'A\n\n| H |\n|---|\n| C |\n\nB\n']) {
      const state = stateOf(page);
      const selected = state.apply(state.tr.setSelection(NodeSelection.create(state.doc, state.doc.child(0).nodeSize)));
      const after = outline(press(selected, 'after'));
      expect(after[2], page).toBe('paragraph: |');
      const before = outline(press(selected, 'before'));
      expect(before[1], page).toBe('paragraph: |');
    }
  });

  it('adds after the table from cells selected', () => {
    const state = stateOf('| A | B |\n|---|---|\n| C | D |\n\nNext\n');
    let cells: number[] = [];
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'table_cell' || node.type.name === 'table_header') cells.push(pos);
    });
    cells = [cells[0], cells[3]];
    const selected = state.apply(state.tr.setSelection(CellSelection.create(state.doc, cells[0], cells[1])));
    expect(outline(press(selected, 'after'))).toEqual(['table', 'paragraph: |', 'paragraph: Next']);
  });

  it('writes the page as before: empty lines are not saved', () => {
    const page = '| A   |\n|-----|\n| B   |\n\nNext\n';
    const { front } = parsePage(page);
    expect(writePage(press(stateOf(page.replace('B', 'B‸')), 'after').doc, front)).toBe(page);
  });
});

describe('the line at the end of the page', () => {
  it('follows a page ending in any block but an empty line, before the notes', () => {
    for (const page of ['| A |\n|---|\n| B |\n', '```\nx\n```\n', '> [!info]\n> A\n', '- A\n', '$$\nx\n$$\n', 'Text.[^1]\n\n[^1]: Note.\n']) {
      const doc = endsWithALine(parsePage(page).doc);
      const last = doc.lastChild!.type.name === 'footnotes' ? doc.child(doc.childCount - 2) : doc.lastChild!;
      expect(last.type.name, page).toBe('paragraph');
      expect(last.content.size, page).toBe(0);
    }
  });

  it('is not added twice, and the page is written as before', () => {
    const { doc, front } = parsePage('Text\n');
    const once = endsWithALine(doc);
    expect(endsWithALine(once)).toBe(once);
    expect(writePage(once, front)).toBe('Text\n');
  });
});

describe('what the review found', () => {
  it('moves out of a list item level by level: a quote in an item, a list in a list', () => {
    const quote = press(press(press(stateOf('- A\n\n  > Q‸\n'), 'after'), 'after'), 'after');
    expect(outline(quote)).toEqual(['bullet_list', '  list_item', '    paragraph: A', '    blockquote', '      paragraph: Q', '  list_item', '    paragraph: |']);
    const nested = press(press(stateOf('- A\n  - B‸\n'), 'after'), 'after');
    expect(outline(nested)).toEqual(['bullet_list', '  list_item', '    paragraph: A', '    bullet_list', '      list_item', '        paragraph: B', '  list_item', '    paragraph: |']);
    // And one more press leaves the list.
    expect(outline(press(nested, 'after')).slice(-1)).toEqual(['paragraph: |']);
  });

  it('adds beside a container holding only an empty line, leaving it as it is', () => {
    const state = stateOf('> ‸x\n'.replace('x', ''));
    expect(outline(press(state, 'after'))).toEqual(['blockquote', '  paragraph: ', 'paragraph: |']);
  });

  it("leaves a callout's only, empty list item as one empty line", () => {
    const state = stateOf('> [!info]\n> - x‸\n');
    const emptied = state.apply(state.tr.delete(state.selection.from - 1, state.selection.from));
    expect(outline(press(emptied, 'after'))).toEqual(['callout', '  paragraph: |']);
  });

  it('adds after the block a selection ends in', () => {
    const state = stateOf('One\n\nTwo\n\nThree\n');
    const across = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2, state.doc.content.size - 3)));
    expect(outline(press(across, 'after'))).toEqual(['paragraph: One', 'paragraph: Two', 'paragraph: Three', 'paragraph: |']);
  });

  it('adds at a gap cursor between two tables, and around everything for select all', () => {
    const state = stateOf('| A |\n|---|\n| B |\n\n| C |\n|---|\n| D |\n');
    const between = state.doc.child(0).nodeSize;
    const gap = state.apply(state.tr.setSelection(new GapCursor(state.doc.resolve(between))));
    expect(outline(press(gap, 'after'))).toEqual(['table', 'paragraph: |', 'table']);
    const all = state.apply(state.tr.setSelection(new AllSelection(state.doc)));
    expect(outline(press(all, 'after'))).toEqual(['table', 'table', 'paragraph: |']);
    expect(outline(press(all, 'before'))).toEqual(['paragraph: |', 'table', 'table']);
  });
});

describe('the second review: moving out before, one level a press', () => {
  it('leaves a list from its empty first item', () => {
    expect(outline(press(stateOf('Intro\n\n- ‸x\n- B\n'.replace('x', '')), 'before'))).toEqual(['paragraph: Intro', 'paragraph: |', 'bullet_list', '  list_item', '    paragraph: B']);
  });

  it('leaves a nested list, then its item, then the list, before', () => {
    const once = press(stateOf('- A\n  - ‸x\n  - B\n'.replace('x', '')), 'before');
    expect(outline(once)).toEqual(['bullet_list', '  list_item', '    paragraph: A', '    paragraph: |', '    bullet_list', '      list_item', '        paragraph: B']);
    const twice = press(once, 'before');
    expect(outline(twice)).toEqual(['bullet_list', '  list_item', '    paragraph: |', '  list_item', '    paragraph: A', '    bullet_list', '      list_item', '        paragraph: B']);
    expect(outline(press(twice, 'before'))[0]).toBe('paragraph: |');
  });

  it("an item's empty second line: a new item before, then out of the list", () => {
    const once = press(stateOf('- A\n\n  ‸x\n\n  More\n'.replace('x', '')), 'before');
    expect(outline(once)).toEqual(['bullet_list', '  list_item', '    paragraph: |', '  list_item', '    paragraph: A', '    paragraph: More']);
    expect(outline(press(once, 'before'))).toEqual(['paragraph: |', 'bullet_list', '  list_item', '    paragraph: A', '    paragraph: More']);
  });

  it('leaves a nested list into its item when more of the item follows', () => {
    const src = '- A\n  - B\n  - ‸x\n\n  More\n'.replace('x', '');
    expect(outline(press(stateOf(src), 'after'))).toEqual(['bullet_list', '  list_item', '    paragraph: A', '    bullet_list', '      list_item', '        paragraph: B', '    paragraph: |', '    paragraph: More']);
  });
});

describe('the third review: an empty item in the middle of a list', () => {
  it('leaves one level, as Enter does, and a further press reaches the page', () => {
    const middle = press(stateOf('- A‸\n- B\n'), 'after');
    const lifted = press(middle, 'after');
    expect(outline(lifted)).toEqual(['bullet_list', '  list_item', '    paragraph: A', 'paragraph: |', 'bullet_list', '  list_item', '    paragraph: B']);
    expect(outline(press(lifted, 'after'))).toEqual(['bullet_list', '  list_item', '    paragraph: A', 'paragraph: ', 'paragraph: |', 'bullet_list', '  list_item', '    paragraph: B']);
  });

  it('climbs out of a nested list in the middle of its list, press by press', () => {
    let state = stateOf('- A\n  - B‸\n- C\n');
    // A new nested item, then a new item of the outer list, then the page.
    for (let i = 0; i < 3; i += 1) state = press(state, 'after');
    expect(outline(state)).toEqual([
      'bullet_list',
      '  list_item',
      '    paragraph: A',
      '    bullet_list',
      '      list_item',
      '        paragraph: B',
      'paragraph: |',
      'bullet_list',
      '  list_item',
      '    paragraph: C',
    ]);
  });

  it('mirrors it before', () => {
    const middle = press(stateOf('- A\n- ‸B\n'), 'before');
    const lifted = press(middle, 'before');
    expect(outline(lifted)).toEqual(['bullet_list', '  list_item', '    paragraph: A', 'paragraph: |', 'bullet_list', '  list_item', '    paragraph: B']);
  });
});
