// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { DocEditor } from './editor';
import { footnoteNumbers } from './footnotes';
import { parsePage } from './markdown';
import { runItem, SLASH_ITEMS } from './slash';

let editor: DocEditor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function open(markdown: string) {
  const host = document.createElement('div');
  document.body.append(host);
  editor = new DocEditor();
  editor.mount(host, { onChange: vi.fn() });
  editor.setPage(markdown);
  return { host, view: editor.view! };
}

function type(text: string) {
  const view = editor!.view!;
  for (const char of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
  }
}

const numbers = (host: HTMLElement) => [...host.querySelectorAll('.footnote-ref')].map((el) => el.getAttribute('data-number'));

describe('footnote numbers', () => {
  it('count in reading order, whatever the labels', () => {
    const doc = parsePage('B[^b] then A[^a] then B again[^b].\n\n[^a]: A.\n\n[^b]: B.\n').doc;
    expect([...footnoteNumbers(doc)]).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });

  it('are shown on each reference and renumber when the text moves', () => {
    const { host, view } = open('First[^x].\n\nSecond[^y].\n\n[^x]: X.\n\n[^y]: Y.\n');
    expect(numbers(host)).toEqual(['1', '2']);
    // The second paragraph moves above the first.
    const second = view.state.doc.child(1);
    const at = view.state.doc.child(0).nodeSize;
    view.dispatch(view.state.tr.delete(at, at + second.nodeSize).insert(0, second));
    expect(numbers(host)).toEqual(['1', '2']);
    expect([...host.querySelectorAll('.footnote-ref')].map((el) => el.getAttribute('data-label'))).toEqual(['y', 'x']);
  });
});

describe('footnotes in the page', () => {
  it('inserts a reference at the caret and a note at the foot, with the caret in the note', () => {
    const { view } = open('A claim\n');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 8)));
    runItem(view, SLASH_ITEMS.find((i) => i.id === 'footnote')!);
    type('The source.');
    expect(editor!.markdown()).toBe('A claim[^1]\n\n[^1]: The source.\n');
  });

  it('takes the next free number as the new label', () => {
    const { view } = open('One[^1] and[^note].\n\n[^1]: A.\n\n[^note]: B.\n');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 4)));
    runItem(view, SLASH_ITEMS.find((i) => i.id === 'footnote')!);
    type('C.');
    expect(editor!.markdown()).toBe('One[^2][^1] and[^note].\n\n[^2]: C.\n\n[^1]: A.\n\n[^note]: B.\n');
  });

  // Moving a sentence is a cut and a paste: its note must survive the moment
  // in between, when nothing refers to it.
  it('keeps a note while its reference is cut, and joins them again when it is pasted', () => {
    const page = 'Keep[^a] and move[^b].\n\nHere.\n\n[^a]: A.\n\n[^b]: B.\n';
    const { view } = open(page);
    let refB = -1;
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'footnote_ref' && node.attrs.label === 'b') refB = pos;
    });
    const ref = view.state.doc.nodeAt(refB)!;
    view.dispatch(view.state.tr.delete(refB, refB + 1));
    const notes = () => editor!.view!.state.doc.lastChild!.childCount;
    expect(notes()).toBe(2);
    // Pasted at the end of "Here".
    let here = -1;
    editor!.view!.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'Here.') here = pos + 5;
    });
    editor!.view!.dispatch(editor!.view!.state.tr.insert(here, ref));
    expect(editor!.markdown()).toBe('Keep[^a] and move.\n\nHere[^b].\n\n[^a]: A.\n\n[^b]: B.\n');
  });

  it('leaves out, on save, a note whose last reference was deleted', () => {
    const { view } = open('Keep[^a] and drop[^b].\n\n[^a]: A.\n\n[^b]: B.\n');
    let refB = -1;
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'footnote_ref' && node.attrs.label === 'b') refB = pos;
    });
    view.dispatch(view.state.tr.delete(refB, refB + 1));
    expect(editor!.markdown()).toBe('Keep[^a] and drop.\n\n[^a]: A.\n');
  });

  it('leaves out, on save, a new footnote whose reference was deleted', () => {
    const { view } = open('Claim\n');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 6)));
    runItem(view, SLASH_ITEMS.find((i) => i.id === 'footnote')!);
    type('Gone.');
    const v = editor!.view!;
    v.dispatch(v.state.tr.delete(6, 7));
    expect(editor!.markdown()).toBe('Claim\n');
  });

  it('keeps a note nothing referred to when the page is edited', () => {
    const { view } = open('Text.\n\n[^unused]: Kept.\n');
    view.dispatch(view.state.tr.insertText('More ', 1));
    expect(editor!.markdown()).toBe('More Text.\n\n[^unused]: Kept.\n');
  });

  it('goes to the note when its reference is clicked', () => {
    const { host, view } = open('Claim[^1].\n\n[^1]: The note.\n');
    const ref = host.querySelector('.footnote-ref')!;
    view.someProp('handleClickOn', (f) => f(view, 6, view.state.doc.nodeAt(6)!, 6, new MouseEvent('click'), true));
    expect(view.state.selection.$from.parent.textContent).toBe('The note.');
    expect(ref).not.toBeNull();
  });
});
