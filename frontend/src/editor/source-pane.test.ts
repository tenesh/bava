// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { SourcePane } from './source-pane';
import spec from '../../../internal/app/menu/spec.json';
import { reservedByMenu, type MenuSpec } from '../shell/shortcuts';
import { onTeardown } from '../test/render';

/** A pane the shared teardown destroys when the test ends. */
function newPane(): SourcePane {
  const pane = new SourcePane();
  onTeardown(() => pane.destroy());
  return pane;
}

// The native menu owns Cmd+Z, so the editor's keymap never sees it. If these
// do nothing, undo in the source editor silently stops working.
describe('SourcePane edit commands', () => {
  function mounted(isReserved?: (binding: { key?: string }) => boolean) {
    const pane = newPane();
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
  });

  it('selects the whole document', () => {
    const { pane, view } = mounted();
    pane.selectAll();
    expect(view.state.selection.main.from).toBe(0);
    expect(view.state.selection.main.to).toBe(6);
  });

  it('copies and replaces the selection as one undoable step', () => {
    const { pane, view } = mounted();
    view.dispatch({ selection: { anchor: 0, head: 1 } });
    expect(pane.selectedText()).toBe('a');
    pane.replaceSelection('x');
    expect(pane.doc).toBe('x -> b');
    pane.undo();
    expect(pane.doc).toBe('a -> b');
  });

  it('drops key bindings the menu reserves', () => {
    const { pane, view } = mounted((binding) => binding.key === 'Mod-z');
    view.dispatch({ changes: { from: 6, insert: '!' } });
    const event = new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', keyCode: 90, ctrlKey: true, bubbles: true, cancelable: true });
    view.contentDOM.dispatchEvent(event);
    expect(pane.doc).toBe('a -> b!');
  });

  it('does nothing before it is mounted', () => {
    const pane = newPane();
    expect(() => {
      pane.undo();
      pane.redo();
      pane.selectAll();
    }).not.toThrow();
  });
});

// Edit commands arrive from the native menu and go to the editor with focus.
// Two source panes can be on screen (the document's and the D2 diagram
// dialog's): Paste in the dialog went into the document's pane, unseen.
describe('the pane an element is in', () => {
  it('is the pane whose editor contains it, not another', () => {
    const first = newPane();
    const second = newPane();
    const a = document.createElement('div');
    const b = document.createElement('div');
    document.body.append(a, b);
    first.mount(a, { doc: 'one', onChange: () => {} });
    second.mount(b, { doc: 'two', onChange: () => {} });
    const inside = b.querySelector('.cm-content')!;
    expect(SourcePane.containing(inside)).toBe(second);
    SourcePane.containing(inside)!.replaceSelection('pasted ');
    expect(second.doc).toContain('pasted');
    expect(first.doc).toBe('one');
  });

  it('is none for an element outside every pane, or after the pane is destroyed', () => {
    const pane = newPane();
    const host = document.createElement('div');
    document.body.append(host);
    pane.mount(host, { doc: 'x', onChange: () => {} });
    const inside = host.querySelector('.cm-content')!;
    expect(SourcePane.containing(document.body)).toBeNull();
    pane.destroy();
    expect(SourcePane.containing(inside)).toBeNull();
  });
});

// The D2 diagram dialog's editor reads its D2 as D2.
describe('SourcePane writing D2', () => {
  function mounted(onSubmit?: () => void) {
    const pane = newPane();
    const host = document.createElement('div');
    document.body.append(host);
    pane.mount(host, { doc: 'api: { shape: cylinder }', onChange: () => {}, onSubmit });
    const view = EditorView.findFromDOM(host.querySelector('.cm-editor') as HTMLElement)!;
    return { pane, view, host };
  }
  const press = (view: EditorView, key: string, modifiers: KeyboardEventInit = {}) =>
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers }));

  it('colours a name and a reserved word as the canvas does', () => {
    const { host } = mounted();
    const coloured = (text: string) => [...host.querySelectorAll('.cm-line span')].find((span) => span.textContent === text)?.className;
    expect(coloured('api')).toBe('syntax-name');
    expect(coloured('shape')).toBe('syntax-keyword');
  });

  it('comments a line with Mod-/ and indents with Tab', () => {
    const { pane, view } = mounted();
    view.dispatch({ selection: { anchor: 0 } });
    press(view, '/', { ctrlKey: true });
    expect(pane.doc).toBe('# api: { shape: cylinder }');
    press(view, 'Tab');
    expect(pane.doc).toBe('  # api: { shape: cylinder }');
  });

  // Tab indents, so the dialog is finished from the editor: Mod-Enter inserts.
  it('asks to insert with Mod-Enter', () => {
    let submitted = 0;
    const { view } = mounted(() => (submitted += 1));
    press(view, 'Enter', { ctrlKey: true });
    expect(submitted).toBe(1);
  });
});

// Tab indents, so there must be a way to let it move focus again, on every
// platform, past every key the menu claims there (Minimise takes Ctrl-M).
describe('leaving the D2 editor by keyboard', () => {
  for (const platform of ['darwin', 'windows', 'linux'] as const) {
    it(`hands Tab back to focus with Shift-Alt-M on ${platform}`, () => {
      const pane = newPane();
      const host = document.createElement('div');
      document.body.append(host);
      pane.mount(host, { doc: 'a -> b', onChange: () => {}, isReserved: reservedByMenu(spec as MenuSpec, platform) });
      const view = EditorView.findFromDOM(host.querySelector('.cm-editor') as HTMLElement)!;
      const press = (init: KeyboardEventInit) => {
        const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
        view.contentDOM.dispatchEvent(event);
        return event.defaultPrevented;
      };
      expect(press({ key: 'Tab', keyCode: 9 })).toBe(true);
      expect(press({ key: 'M', keyCode: 77, shiftKey: true, altKey: true })).toBe(true);
      // Now Tab is the browser's: it moves focus, and the code is untouched.
      const before = pane.doc;
      expect(press({ key: 'Tab', keyCode: 9 })).toBe(false);
      expect(pane.doc).toBe(before);
    });
  }
});
