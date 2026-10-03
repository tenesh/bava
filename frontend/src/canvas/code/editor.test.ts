// @vitest-environment jsdom
import { onTeardown } from '../../test/render';
import { describe, expect, it, vi } from 'vitest';
import { EditorView } from '@codemirror/view';
import { CodeEditor, commitCode, fitToCode } from './editor';
import { createHistory } from '../history';
import { editTarget } from '../../shell/edit-target';

/** An editor taken down by the shared teardown, whatever the test does. */
function tracked<T extends { destroy(): void }>(editor: T): T {
  let destroyed = false;
  const destroy = editor.destroy.bind(editor);
  editor.destroy = () => {
    if (destroyed) return;
    destroyed = true;
    destroy();
  };
  onTeardown(() => editor.destroy());
  return editor;
}

function host() {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
}

describe('typing in a code block', () => {
  it('opens with the block code, and canvas keys stand down', async () => {
    const editor = tracked(new CodeEditor(host()));
    await editor.open({ code: 'const a = 1', rect: { x: 0, y: 0, width: 200, height: 60 }, onCommit: vi.fn() });

    expect(document.querySelector('.cm-content')!.textContent).toContain('const a = 1');
    // Typing "r" here must not switch to the rectangle tool, and undo here
    // must not reach the D2 source pane.
    expect(editTarget(document.activeElement, { canvasVisible: true })).toBe('code');
    editor.destroy();
  });

  it('commits what was typed, once', async () => {
    const onCommit = vi.fn();
    const editor = tracked(new CodeEditor(host()));
    await editor.open({ code: 'before', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit });

    editor.commit();
    editor.commit();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('before');
  });

  // Escape is how every other editor in Bava is closed.
  it('commits on Escape', async () => {
    const onCommit = vi.fn();
    const editor = tracked(new CodeEditor(host()));
    await editor.open({ code: 'x', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit });

    document.querySelector('.cm-content')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith('x');
    expect(editor.isOpen).toBe(false);
  });

  // Enter belongs to the code, not to closing: this is a multi-line editor.
  it('keeps Enter for the code', async () => {
    const onCommit = vi.fn();
    const editor = tracked(new CodeEditor(host()));
    await editor.open({ code: 'x', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit });

    document.querySelector('.cm-content')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).not.toHaveBeenCalled();
    editor.destroy();
  });

  it('is taken away when it is destroyed', async () => {
    const editor = tracked(new CodeEditor(host()));
    await editor.open({ code: 'x', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit: vi.fn() });
    editor.destroy();
    expect(document.querySelector('.cm-editor')).toBeNull();
  });

  it('highlights in the language it is given', async () => {
    const editor = tracked(new CodeEditor(host()));
    await editor.open({
      code: 'const a = 1',
      language: 'javascript',
      rect: { x: 0, y: 0, width: 200, height: 60 },
      onCommit: vi.fn(),
    });
    // The language's support is in the editor's state, so `const` is a keyword
    // rather than plain text.
    expect(document.querySelector('.cm-content')!.innerHTML).toContain('ͼ');
    editor.destroy();
  });
});

// Committing a code block writes the code and the height it implies, in one
// step: its width is the user's and its height follows (docs/file-format.md).
describe('committing a code block', () => {
  it('writes the code and the new measurement together', () => {
    const history = createHistory({
      elements: [
        { id: 'c', type: 'code', x: 0, y: 0, w: 50, h: 30, code: 'a', measuredWidth: 50, measuredHeight: 30 },
      ] as never[],
    });

    commitCode(history, 'c', 'a\nbb\nccc', { advance: 6, lineHeight: 20, padding: 8 });

    const block = history.current.elements[0] as unknown as Record<string, number | string>;
    expect(block.code).toBe('a\nbb\nccc');
    expect(block.h).toBe(3 * 20 + 16);
    // The width is the user's, kept through an edit.
    expect(block.w).toBe(50);
    expect(block.measuredWidth).toBe(block.w);
    expect(block.measuredHeight).toBe(block.h);
  });

  it('records nothing when the code did not change', () => {
    const history = createHistory({
      elements: [{ id: 'c', type: 'code', x: 0, y: 0, w: 50, h: 30, code: 'a', measuredWidth: 50, measuredHeight: 30 }] as never[],
    });
    commitCode(history, 'c', 'a', { advance: 6, lineHeight: 20, padding: 8 });
    expect(history.canUndo).toBe(false);
  });

  // An emptied code block is still a block: unlike text, it is a panel the
  // user placed deliberately and can type into again.
  it('keeps a block whose code was emptied', () => {
    const history = createHistory({
      elements: [{ id: 'c', type: 'code', x: 0, y: 0, w: 50, h: 30, code: 'a', measuredWidth: 50, measuredHeight: 30 }] as never[],
    });
    commitCode(history, 'c', '', { advance: 6, lineHeight: 20, padding: 8 });
    expect(history.current.elements).toHaveLength(1);
    expect((history.current.elements[0] as { code: string }).code).toBe('');
  });
});

// Closing the canvas with the editor open must not throw away what was typed:
// the file is the user's work, and nothing may be lost on the way out.
describe('destroying an open editor', () => {
  it('commits first', async () => {
    const onCommit = vi.fn();
    const editor = tracked(new CodeEditor(host()));
    await editor.open({ code: 'typed', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit });
    editor.destroy();
    expect(onCommit).toHaveBeenCalledWith('typed');
  });
});

describe('an editor on a rotated block', () => {
  it('turns with it, and scales with the zoom', async () => {
    const editor = tracked(new CodeEditor(host()));
    await editor.open({
      code: 'x',
      angle: 30,
      zoom: 2,
      rect: { x: 0, y: 0, width: 100, height: 40 },
      onCommit: vi.fn(),
    });
    const wrapper = document.querySelector('.bava-code-editor') as HTMLElement;
    expect(wrapper.style.transform).toContain('rotate(30deg)');
    // The typed text has to match the block under it at any zoom.
    expect(wrapper.style.fontSize).not.toBe('');
    editor.destroy();
  });
});

// The native menu takes the accelerators before the webview sees them, so
// these commands reach the editor as commands or not at all.
describe('the edit commands inside a code editor', () => {
  it('undoes and redoes its own typing', async () => {
    const editor = tracked(new CodeEditor(host()));
    await editor.open({ code: 'start', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit: vi.fn() });

    editor.replaceSelection('more');
    expect(editor.text()).toContain('more');
    editor.undo();
    expect(editor.text()).toBe('start');
    editor.redo();
    expect(editor.text()).toContain('more');
    editor.destroy();
  });

  it('selects all, and reports what is selected for Copy', async () => {
    const editor = tracked(new CodeEditor(host()));
    await editor.open({ code: 'abc', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit: vi.fn() });
    editor.selectAll();
    expect(editor.selectedText()).toBe('abc');
    editor.destroy();
  });

  it('does nothing at all when it is not open', () => {
    const editor = tracked(new CodeEditor(host()));
    expect(() => {
      editor.undo();
      editor.selectAll();
      editor.replaceSelection('x');
    }).not.toThrow();
    expect(editor.selectedText()).toBe('');
  });
});

// The editor covers the block while it is typed in. Kept at the size it opened
// with, it clipped everything past the first column of a new, empty block.
describe('the editor growing with what is typed', () => {
  it('widens for a longer line, and grows taller for a new one', async () => {
    const h = host();
    const editor = tracked(new CodeEditor(h));
    const measure = (code: string) => {
      const lines = code.split('\n');
      return { width: Math.max(...lines.map((l) => l.length)) * 10, height: lines.length * 20 };
    };
    await editor.open({ code: 'ab', rect: { x: 0, y: 0, width: 20, height: 20 }, measure, onCommit: vi.fn() });
    const wrapper = h.querySelector<HTMLElement>('.bava-code-editor')!;
    const view = EditorView.findFromDOM(wrapper.querySelector('.cm-editor') as HTMLElement)!;
    view.dispatch({ changes: { from: 2, insert: 'cdef\nx' } });
    expect(wrapper.style.width).toBe('60px');
    expect(wrapper.style.height).toBe('40px');
    editor.destroy();
  });
});

// An edit keeps the width the user gave the block; the height follows.
describe('committing code to a block of a chosen width', () => {
  it('keeps the width and wraps to it', () => {
    const metrics = { advance: 6, lineHeight: 20, padding: 8 };
    const history = createHistory({
      elements: [{ id: 'c', type: 'code', x: 0, y: 0, w: 76, h: 36, z: 1, code: 'x', measuredWidth: 76, measuredHeight: 36 }] as never,
    });
    commitCode(history, 'c', 'abcdefghijklmnop', metrics);
    expect(history.current.elements[0]).toMatchObject({ w: 76, h: 56 });
  });

  it('wraps lines in the editor, as the block does', async () => {
    const h = host();
    const editor = tracked(new CodeEditor(h));
    await editor.open({ code: 'x', rect: { x: 0, y: 0, width: 100, height: 40 }, onCommit: vi.fn() });
    expect(h.querySelector('.cm-lineWrapping')).not.toBeNull();
    editor.destroy();
  });
});

// The code block editor drops the keys the
// menu owns, as the source pane does, and Tab indents rather than leaving.
describe('keys in the code block editor', () => {
  it('drops a key the menu reserves', async () => {
    const h = host();
    const editor = tracked(new CodeEditor(h));
    await editor.open({ code: 'x', rect: { x: 0, y: 0, width: 100, height: 40 }, isReserved: (b) => b.key === 'Mod-z', onCommit: vi.fn() });
    const view = EditorView.findFromDOM(h.querySelector('.cm-editor') as HTMLElement)!;
    view.dispatch({ changes: { from: 1, insert: '!' } });
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', keyCode: 90, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(view.state.doc.toString()).toBe('x!');
    editor.destroy();
  });

  it('indents with Tab instead of leaving', async () => {
    const h = host();
    const onCommit = vi.fn();
    const editor = tracked(new CodeEditor(h));
    await editor.open({ code: 'x', rect: { x: 0, y: 0, width: 100, height: 40 }, onCommit });
    const view = EditorView.findFromDOM(h.querySelector('.cm-editor') as HTMLElement)!;
    view.dispatch({ selection: { anchor: 0 } });
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, bubbles: true, cancelable: true }));
    expect(view.state.doc.toString()).not.toBe('x');
    expect(onCommit).not.toHaveBeenCalled();
    editor.destroy();
  });
});

// The app's own reservation, not one the test makes up: the menu's Undo key on
// Windows and Linux is dropped by the code block's editor.
describe('the code editor on the app path', () => {
  it('drops Ctrl+Z given the menu spec', async () => {
    const { reservedByMenu } = await import('../../shell/shortcuts');
    const spec = (await import('../../../../internal/app/menu/spec.json')).default;
    const h = host();
    const editor = tracked(new CodeEditor(h));
    await editor.open({ code: 'x', rect: { x: 0, y: 0, width: 100, height: 40 }, isReserved: reservedByMenu(spec as never, 'linux'), onCommit: vi.fn() });
    const view = EditorView.findFromDOM(h.querySelector('.cm-editor') as HTMLElement)!;
    view.dispatch({ changes: { from: 1, insert: '!' } });
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', keyCode: 90, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(view.state.doc.toString()).toBe('x!');
    editor.destroy();
  });
});

describe('committing code to a taller block', () => {
  const metrics = { advance: 6, lineHeight: 20, padding: 8 };
  it('keeps the extra height, and grows when the code needs more', () => {
    const history = createHistory({
      elements: [{ id: 'c', type: 'code', x: 0, y: 0, w: 112, h: 200, z: 1, code: 'x', measuredWidth: 112, measuredHeight: 36 }] as never,
    });
    commitCode(history, 'c', 'y', metrics);
    expect(history.current.elements[0]).toMatchObject({ h: 200 });
    commitCode(history, 'c', Array.from({ length: 12 }, () => 'l').join('\n'), metrics);
    expect(history.current.elements[0]).toMatchObject({ h: 12 * 20 + 16 });
  });
});

describe("the editor over a block at another size", () => {
  it("scales its text with the block's size as well as the zoom", async () => {
    const editor = tracked(new CodeEditor(host()));
    await editor.open({ code: 'x', zoom: 2, fontScale: 1.5, rect: { x: 0, y: 0, width: 100, height: 40 }, onCommit: vi.fn() });
    const wrapper = document.querySelector('.bava-code-editor') as HTMLElement;
    expect(wrapper.style.fontSize).toBe('3em');
    editor.destroy();
  });
});

describe('a code block refitted to its code', () => {
  it('grows to its code at a larger size, keeping its width', () => {
    const block = { id: 'c', type: 'code', x: 0, y: 0, w: 200, h: 36, z: 1, code: 'a\nb', measuredWidth: 200, measuredHeight: 36 } as never;
    fitToCode(block, { advance: 12, lineHeight: 40, padding: 8 });
    expect(block).toMatchObject({ w: 200, h: 96, measuredHeight: 96 });
  });
});
