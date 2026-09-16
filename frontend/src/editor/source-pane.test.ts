// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { SourcePane } from './source-pane';

// The native menu owns Cmd+Z, so the editor's keymap never sees it. If these
// do nothing, undo in the source editor silently stops working.
describe('SourcePane edit commands', () => {
  function mounted(isReserved?: (binding: { key?: string }) => boolean) {
    const pane = new SourcePane();
    const host = document.createElement('div');
    document.body.append(host);
    pane.mount(host, { doc: 'a -> b', onChange: () => {}, isReserved });
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor') as HTMLElement);
    if (!view) throw new Error('editor not mounted');
    return { pane, view };
  }

  it('undoes and redoes an edit', () => {
    const { pane, view } = mounted();
    view.dispatch({ changes: { from: 6, insert: '\nb -> c' } });
    expect(pane.doc).toBe('a -> b\nb -> c');

    pane.undo();
    expect(pane.doc).toBe('a -> b');
    pane.redo();
    expect(pane.doc).toBe('a -> b\nb -> c');
    pane.destroy();
  });

  it('selects the whole document', () => {
    const { pane, view } = mounted();
    pane.selectAll();
    expect(view.state.selection.main.from).toBe(0);
    expect(view.state.selection.main.to).toBe(6);
    pane.destroy();
  });

  it('copies and replaces the selection as one undoable step', () => {
    const { pane, view } = mounted();
    view.dispatch({ selection: { anchor: 0, head: 1 } });
    expect(pane.selectedText()).toBe('a');
    pane.replaceSelection('x');
    expect(pane.doc).toBe('x -> b');
    pane.undo();
    expect(pane.doc).toBe('a -> b');
    pane.destroy();
  });

  it('drops key bindings the menu reserves', () => {
    const { pane, view } = mounted((binding) => binding.key === 'Mod-z');
    view.dispatch({ changes: { from: 6, insert: '!' } });
    const event = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', keyCode: 90, ctrlKey: true, bubbles: true, cancelable: true });
    view.contentDOM.dispatchEvent(event);
    expect(pane.doc).toBe('a -> b!');
    pane.destroy();
  });

  it('does nothing before it is mounted', () => {
    const pane = new SourcePane();
    expect(() => {
      pane.undo();
      pane.redo();
      pane.selectAll();
    }).not.toThrow();
  });
});
