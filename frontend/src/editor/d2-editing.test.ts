// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { insertNewlineAndIndent, indentMore, indentLess, toggleComment } from '@codemirror/commands';
import { matchBrackets } from '@codemirror/language';
import { insertBracket } from '@codemirror/autocomplete';
import { d2Support } from './d2-language';
import { onTeardown } from '../test/render';

/** An editor over `doc` with D2's help, the cursor where the last `|` is (an earlier one can open a block string). */
function editor(doc: string) {
  const at = doc.lastIndexOf('|');
  const view = new EditorView({
    state: EditorState.create({ doc: doc.slice(0, at) + doc.slice(at + 1), selection: EditorSelection.cursor(at), extensions: [d2Support()] }),
    parent: document.body,
  });
  onTeardown(() => view.destroy());
  return view;
}

const text = (view: EditorView) => view.state.doc.toString();

describe('typing D2', () => {
  it('indents the line after an opening brace, two spaces deeper', () => {
    const view = editor('api: {|');
    insertNewlineAndIndent(view);
    expect(text(view)).toBe('api: {\n  ');
  });

  it('lines a closing brace up with the line that opened it', () => {
    const view = editor('api: {\n  shape: cylinder\n  |');
    const head = view.state.selection.main.head;
    // As typing does: the brace in, the cursor after it.
    view.dispatch(view.state.update({ changes: { from: head, insert: '}' }, selection: { anchor: head + 1 }, userEvent: 'input.type' }));
    // indentOnInput reindents the line once the brace is typed.
    expect(text(view)).toBe('api: {\n  shape: cylinder\n}');
  });

  // Inside a block string the code is someone else's: D2's braces do not set its indent.
  it('leaves the indent alone inside a block string', () => {
    const view = editor('a: {\n  code: |js\n    if (x) {\n      y()\n      |');
    const head = view.state.selection.main.head;
    view.dispatch(view.state.update({ changes: { from: head, insert: '}' }, selection: { anchor: head + 1 }, userEvent: 'input.type' }));
    expect(text(view).split('\n').at(-1)).toBe('      }');
  });

  it('closes a brace, a bracket and a quote as they are typed', () => {
    for (const [open, close] of [['{', '}'], ['[', ']'], ['"', '"']]) {
      const view = editor('a: |');
      const transaction = insertBracket(view.state, open);
      expect(transaction, open).not.toBeNull();
      view.dispatch(transaction!);
      expect(text(view)).toBe(`a: ${open}${close}`);
    }
  });

  it('turns the selected lines into # comments, and back', () => {
    const view = editor('|a -> b\nb -> c');
    view.dispatch({ selection: EditorSelection.range(0, view.state.doc.length) });
    toggleComment(view);
    expect(text(view)).toBe('# a -> b\n# b -> c');
    toggleComment(view);
    expect(text(view)).toBe('a -> b\nb -> c');
  });

  it('indents and outdents the selected lines', () => {
    const view = editor('|a\nb');
    view.dispatch({ selection: EditorSelection.range(0, view.state.doc.length) });
    indentMore(view);
    expect(text(view)).toBe('  a\n  b');
    indentLess(view);
    expect(text(view)).toBe('a\nb');
  });

  it('marks the bracket that matches the one at the cursor', () => {
    const view = editor('api: |{ shape: cylinder }');
    const match = matchBrackets(view.state, view.state.selection.main.head, 1);
    expect(match?.matched).toBe(true);
    expect(match?.end?.from).toBe('api: { shape: cylinder '.length);
  });
});
