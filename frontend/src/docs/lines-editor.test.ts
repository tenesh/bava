// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { DocEditor } from './editor';

let editor: DocEditor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function open(markdown: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const onChange = vi.fn();
  editor = new DocEditor();
  editor.mount(host, { onChange });
  editor.setPage(markdown);
  return { onChange, view: editor.view! };
}

function key(name: string, mods: KeyboardEventInit = {}) {
  const view = editor!.view!;
  return view.someProp('handleKeyDown', (f) => f(view, new KeyboardEvent('keydown', { key: name, bubbles: true, ...mods })));
}

const mod = /Mac/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };

function caretIn(text: string) {
  const view = editor!.view!;
  let at = -1;
  view.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text!.includes(text)) at = pos + node.text!.indexOf(text) + text.length;
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
}

describe('adding a block from the keyboard', () => {
  it('adds after with ⌘Enter and before with ⇧⌘Enter, the caret on the new line', () => {
    const { view } = open('| A |\n|---|\n| B |\n\nNext\n');
    caretIn('B');
    expect(key('Enter', mod)).toBe(true);
    expect(view.state.selection.$from.parent.content.size).toBe(0);
    expect(view.state.doc.child(1).type.name).toBe('paragraph');
    caretIn('Next');
    expect(key('Enter', { ...mod, shiftKey: true })).toBe(true);
    expect(view.state.doc.childCount).toBe(5);
  });

  it('is undone in one step', () => {
    const { view } = open('One\n\nTwo\n');
    caretIn('One');
    const before = view.state.doc;
    key('Enter', mod);
    editor!.undo();
    expect(view.state.doc.eq(before)).toBe(true);
  });

  it('adds nothing on a locked page', () => {
    const { view } = open('---\nbava:\n  locked: true\n---\nOne\n');
    caretIn('One');
    const before = view.state.doc;
    key('Enter', mod);
    expect(view.state.doc.eq(before)).toBe(true);
  });
});

describe('the empty line at the end of the page', () => {
  it('is there after reading a page ending in a table, and the page still saves as read', () => {
    const page = '| A |\n|---|\n| B |\n';
    const { view } = open(page);
    const last = view.state.doc.lastChild!;
    expect([last.type.name, last.content.size]).toEqual(['paragraph', 0]);
    expect(editor!.markdown()).toBe(page);
  });

  it('comes back when it is deleted, or typed into', () => {
    const { view } = open('Text\n');
    const last = () => view.state.doc.lastChild!;
    const end = view.state.doc.content.size;
    view.dispatch(view.state.tr.insertText('x', end - 1));
    expect([last().type.name, last().content.size]).toEqual(['paragraph', 0]);
    view.dispatch(view.state.tr.delete(view.state.doc.content.size - last().nodeSize, view.state.doc.content.size));
    expect([last().type.name, last().content.size]).toEqual(['paragraph', 0]);
  });
});

describe('the block menu and the handle', () => {
  it('adds a block before or after the block at a position', () => {
    const { view } = open('One\n\nTwo\n');
    editor!.addBlockBeside(0, 'before');
    expect(view.state.doc.child(0).content.size).toBe(0);
    expect(view.state.selection.from).toBe(1);
    const two = view.state.doc.child(0).nodeSize + view.state.doc.child(1).nodeSize;
    editor!.addBlockBeside(two, 'after');
    expect(view.state.doc.child(3).content.size).toBe(0);
  });

  it("opens the / menu on a line the handle's + adds above", () => {
    const { view } = open('One\n\nTwo\n');
    editor!.addBlockBefore(view.state.doc.child(0).nodeSize);
    expect(view.state.doc.child(1).textContent).toBe('/');
  });
});

describe('the block menu on the notes', () => {
  it('adds a block before the notes, never after them', () => {
    const { view } = open('X[^1]\n\n[^1]: N\n');
    for (const side of ['after', 'before'] as const) {
      const notes = view.state.doc.content.size - view.state.doc.lastChild!.nodeSize;
      expect(() => editor!.addBlockBeside(notes, side)).not.toThrow();
      const { doc, selection } = view.state;
      expect(doc.lastChild!.type.name).toBe('footnotes');
      // The caret on the new empty line, just before the notes.
      expect(selection.$from.parent.content.size).toBe(0);
      expect(selection.$from.after(1)).toBe(doc.content.size - doc.lastChild!.nodeSize);
    }
  });
});

