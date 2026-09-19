// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeEditor, commitCode } from './editor';
import { createHistory } from '../history';
import { editTarget } from '../../shell/edit-target';

afterEach(() => {
  document.body.innerHTML = '';
});

function host() {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
}

describe('typing in a code block', () => {
  it('opens with the block code, and canvas keys stand down', async () => {
    const editor = new CodeEditor(host());
    await editor.open({ code: 'const a = 1', rect: { x: 0, y: 0, width: 200, height: 60 }, onCommit: vi.fn() });

    expect(document.querySelector('.cm-content')!.textContent).toContain('const a = 1');
    // Typing "r" here must not switch to the rectangle tool, and undo here
    // must not reach the D2 source pane.
    expect(editTarget(document.activeElement, { canvasVisible: true })).toBe('code');
    editor.destroy();
  });

  it('commits what was typed, once', async () => {
    const onCommit = vi.fn();
    const editor = new CodeEditor(host());
    await editor.open({ code: 'before', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit });

    editor.commit();
    editor.commit();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('before');
  });

  // Escape is how every other editor in Bava is closed.
  it('commits on Escape', async () => {
    const onCommit = vi.fn();
    const editor = new CodeEditor(host());
    await editor.open({ code: 'x', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit });

    document.querySelector('.cm-content')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onCommit).toHaveBeenCalledWith('x');
    expect(editor.isOpen).toBe(false);
  });

  // Enter belongs to the code, not to closing: this is a multi-line editor.
  it('keeps Enter for the code', async () => {
    const onCommit = vi.fn();
    const editor = new CodeEditor(host());
    await editor.open({ code: 'x', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit });

    document.querySelector('.cm-content')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onCommit).not.toHaveBeenCalled();
    editor.destroy();
  });

  it('is taken away when it is destroyed', async () => {
    const editor = new CodeEditor(host());
    await editor.open({ code: 'x', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit: vi.fn() });
    editor.destroy();
    expect(document.querySelector('.cm-editor')).toBeNull();
  });

  it('highlights in the language it is given', async () => {
    const editor = new CodeEditor(host());
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

// Committing a code block writes the code and the size it implies, in one
// step: its size comes from its code (docs/file-format.md).
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
    expect(block.w).toBe(3 * 6 + 16);
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
    const editor = new CodeEditor(host());
    await editor.open({ code: 'typed', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit });
    editor.destroy();
    expect(onCommit).toHaveBeenCalledWith('typed');
  });
});

describe('an editor on a rotated block', () => {
  it('turns with it, and scales with the zoom', async () => {
    const editor = new CodeEditor(host());
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
    const editor = new CodeEditor(host());
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
    const editor = new CodeEditor(host());
    await editor.open({ code: 'abc', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit: vi.fn() });
    editor.selectAll();
    expect(editor.selectedText()).toBe('abc');
    editor.destroy();
  });

  it('does nothing at all when it is not open', () => {
    const editor = new CodeEditor(host());
    expect(() => {
      editor.undo();
      editor.selectAll();
      editor.replaceSelection('x');
    }).not.toThrow();
    expect(editor.selectedText()).toBe('');
  });
});
