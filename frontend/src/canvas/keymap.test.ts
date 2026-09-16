import { describe, expect, it, vi } from 'vitest';
import { handleKey } from './keymap';

function actions() {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    copy: vi.fn(),
    paste: vi.fn(),
    selectAll: vi.fn(),
    deleteSelection: vi.fn(),
    selectNext: vi.fn(),
    selectPrevious: vi.fn(),
    nudge: vi.fn(),
    escape: vi.fn(),
    activateTool: vi.fn(),
  };
}

const key = (over: Partial<KeyboardEvent> = {}) =>
  ({ key: 'a', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...over }) as KeyboardEvent;

describe('keymap', () => {
  it('binds undo and redo', () => {
    const a = actions();
    handleKey(key({ key: 'z', metaKey: true }), a, { typing: false });
    expect(a.undo).toHaveBeenCalled();

    handleKey(key({ key: 'z', metaKey: true, shiftKey: true }), a, { typing: false });
    expect(a.redo).toHaveBeenCalled();
  });

  it('binds copy, paste and select all', () => {
    const a = actions();
    handleKey(key({ key: 'c', metaKey: true }), a, { typing: false });
    handleKey(key({ key: 'v', metaKey: true }), a, { typing: false });
    handleKey(key({ key: 'a', metaKey: true }), a, { typing: false });
    expect(a.copy).toHaveBeenCalled();
    expect(a.paste).toHaveBeenCalled();
    expect(a.selectAll).toHaveBeenCalled();
  });

  it('deletes the selection', () => {
    const a = actions();
    handleKey(key({ key: 'Backspace' }), a, { typing: false });
    expect(a.deleteSelection).toHaveBeenCalled();
  });

  it('steps selection with tab', () => {
    const a = actions();
    handleKey(key({ key: 'Tab' }), a, { typing: false });
    expect(a.selectNext).toHaveBeenCalled();
    handleKey(key({ key: 'Tab', shiftKey: true }), a, { typing: false });
    expect(a.selectPrevious).toHaveBeenCalled();
  });

  it('nudges with the arrow keys', () => {
    const a = actions();
    handleKey(key({ key: 'ArrowRight' }), a, { typing: false });
    expect(a.nudge).toHaveBeenCalledWith(1, 0);
    handleKey(key({ key: 'ArrowUp' }), a, { typing: false });
    expect(a.nudge).toHaveBeenCalledWith(0, -1);
  });

  it('activates a tool by its shortcut', () => {
    const a = actions();
    handleKey(key({ key: 'r' }), a, { typing: false });
    expect(a.activateTool).toHaveBeenCalledWith('rect');
  });

  // Without this, typing D2 in the source editor deletes the selection and
  // switches tools on every keystroke.
  it('ignores everything while typing', () => {
    const a = actions();
    for (const event of [
      key({ key: 'r' }),
      key({ key: 'Backspace' }),
      key({ key: 'ArrowRight' }),
      key({ key: 'Tab' }),
    ]) {
      handleKey(event, a, { typing: true });
    }
    expect(a.activateTool).not.toHaveBeenCalled();
    expect(a.deleteSelection).not.toHaveBeenCalled();
    expect(a.nudge).not.toHaveBeenCalled();
    expect(a.selectNext).not.toHaveBeenCalled();
  });

  // Undo while typing belongs to the editor, which has its own history.
  it('leaves undo to the editor while typing', () => {
    const a = actions();
    handleKey(key({ key: 'z', metaKey: true }), a, { typing: true });
    expect(a.undo).not.toHaveBeenCalled();
  });

  it('reports whether it handled the key', () => {
    const a = actions();
    expect(handleKey(key({ key: 'r' }), a, { typing: false })).toBe(true);
    expect(handleKey(key({ key: '9' }), a, { typing: false })).toBe(false);
  });
});
