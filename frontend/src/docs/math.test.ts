// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { NodeSelection } from 'prosemirror-state';
import { DocEditor } from './editor';
import { openEditor } from './test-editor';
import { math, renderTex } from './math';
import { runItem, SLASH_ITEMS } from './slash';
import { parsePage } from './markdown';

const parsePageDoc = (markdown: string) => parsePage(markdown).doc;

let editor: DocEditor | null = null;

function open(markdown: string) {
  const onEquation = vi.fn();
  const opened = openEditor(markdown, { caretAtEnd: true, onEquation });
  editor = opened.editor;
  const { host, view } = opened;
  return { host, onEquation, view };
}

function type(text: string) {
  const view = editor!.view!;
  for (const char of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
  }
}

function key(name: string) {
  const view = editor!.view!;
  return view.someProp('handleKeyDown', (f) => f(view, new KeyboardEvent('keydown', { key: name, bubbles: true })));
}

describe('drawing TeX', () => {
  it('draws a formula', () => {
    const el = document.createElement('span');
    renderTex('x^2', el, false);
    expect(el.querySelector('.katex')).not.toBeNull();
  });

  it('shows a formula that does not parse as its TeX, with the reason', () => {
    const el = document.createElement('span');
    renderTex('\\frac{1', el, false);
    expect(el.querySelector('.math-source')?.textContent).toBe('\\frac{1');
    expect(el.querySelector('.math-error')?.textContent).not.toBe('');
  });
});

describe('equations in the page', () => {
  it('draws block and inline equations', () => {
    const { host } = open('$$\nE = mc^2\n$$\n\nArea $\\pi r^2$.\n');
    expect(host.querySelector('.math-block .katex-display')).not.toBeNull();
    expect(host.querySelector('.math-inline .katex')).not.toBeNull();
  });

  it('makes an inline equation from $…$ typed in a line', () => {
    open('');
    type('Area $x^2$');
    expect(editor!.markdown()).toBe('Area $x^2$\n');
    expect(editor!.view!.state.doc.firstChild!.child(1).type.name).toBe('math_inline');
  });

  it('leaves a price typed in a line as text', () => {
    open('');
    type('It costs $5 and $10.');
    expect(editor!.view!.state.doc.firstChild!.childCount).toBe(1);
  });

  it('makes a block equation from $$ and Enter, and asks for its TeX', () => {
    const { onEquation } = open('');
    type('$$');
    key('Enter');
    expect(editor!.view!.state.doc.firstChild!.type.name).toBe('math_block');
    expect(onEquation).toHaveBeenCalledWith(0, expect.anything());
  });

  it('asks for the TeX of an equation pressed on, or selected and Enter pressed', () => {
    const { host, onEquation, view } = open('Area $\\pi r^2$.\n');
    host.querySelector('.math-inline')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(onEquation).toHaveBeenLastCalledWith(6, expect.anything());
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 6)));
    onEquation.mockClear();
    key('Enter');
    expect(onEquation).toHaveBeenCalledWith(6, expect.anything());
  });

  it('replaces the TeX as one step undo takes back, and deletes an equation left empty', () => {
    const { view } = open('$$\na\n$$\n');
    math.setTex(0, 'b^2')(view.state, view.dispatch);
    expect(editor!.markdown()).toBe('$$\nb^2\n$$\n');
    editor!.undo();
    expect(editor!.markdown()).toBe('$$\na\n$$\n');
    math.setTex(0, '')(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.view!.state.doc.firstChild!.type.name).toBe('paragraph');
  });

  it('keeps TeX typed into an inline equation one that reads back as an equation', () => {
    const { view } = open('Area $x$.\n');
    math.setTex(6, '  a$b\n\nc  ')(view.state, view.dispatch);
    expect(editor!.view!.state.doc.firstChild!.child(1).attrs.tex).toBe('a\\$b c');
    expect(editor!.markdown()).toBe('Area $a\\$b c$.\n');
  });

  it('keeps a line of $$ inside a block equation from ending it', () => {
    const { view } = open('$$\na\n$$\n');
    math.setTex(0, 'a\n$$\nb')(view.state, view.dispatch);
    const once = editor!.markdown()!;
    expect(parsePageDoc(once).firstChild!.type.name).toBe('math_block');
    expect(parsePageDoc(once).childCount).toBe(1);
  });

  it('does not make an equation of $…$ whose closing $ is escaped', () => {
    open('');
    type('Cost $a \\$');
    expect(editor!.view!.state.doc.firstChild!.childCount).toBe(1);
  });

  it('inserts an equation from the / menu and asks for its TeX', () => {
    const { onEquation } = open('');
    runItem(editor!.view!, SLASH_ITEMS.find((i) => i.id === 'equation')!);
    expect(editor!.view!.state.doc.firstChild!.type.name).toBe('math_block');
    expect(onEquation).toHaveBeenCalled();
    open('Area ');
    runItem(editor!.view!, SLASH_ITEMS.find((i) => i.id === 'inlineEquation')!);
    expect(editor!.view!.state.doc.firstChild!.lastChild!.type.name).toBe('math_inline');
  });
});
