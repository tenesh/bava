import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { handleKey } from './keymap';

function actions() {
  return {
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

  // A shortcut the native menu binds must not also be handled here, or one
  // keypress acts twice: two undos, two pastes. Read from the spec, so a new
  // menu accelerator is checked without editing this test.
  it('TestKeymapDoesNotHandleMenuBoundShortcuts', () => {
    const accelerators = menuAccelerators();
    expect(accelerators.length).toBeGreaterThan(10);
    for (const accelerator of accelerators) {
      for (const primary of ['metaKey', 'ctrlKey'] as const) {
        const a = actions();
        const handled = handleKey(eventFor(accelerator, primary), a, { typing: false });
        expect(handled, `${accelerator} with ${primary}`).toBe(false);
        expect(Object.values(a).some((fn) => fn.mock.calls.length > 0), accelerator).toBe(false);
      }
    }
  });

  it('reports whether it handled the key', () => {
    const a = actions();
    expect(handleKey(key({ key: 'r' }), a, { typing: false })).toBe(true);
    expect(handleKey(key({ key: '9' }), a, { typing: false })).toBe(false);
  });
});

type SpecItem = { kind: string; accelerator?: string; shortcut?: string; items?: SpecItem[] };

function menuAccelerators(): string[] {
  const path = resolve(__dirname, '../../../internal/app/menu/spec.json');
  const spec = JSON.parse(readFileSync(path, 'utf8')) as { menus: SpecItem[] };
  const found: string[] = [];
  const walk = (items: SpecItem[] = []) => {
    for (const item of items) {
      if (item.accelerator) found.push(item.accelerator);
      // Frontend-handled shortcuts dispatch through the menu's commands too.
      if (item.shortcut) found.push(item.shortcut);
      walk(item.items);
    }
  };
  for (const menu of spec.menus) walk(menu.items);
  return found;
}

function eventFor(accelerator: string, primary: 'metaKey' | 'ctrlKey'): KeyboardEvent {
  const parts = accelerator.split('+');
  const keyPart = parts.pop() ?? '';
  const modifiers = new Set(parts.map((part) => part.toLowerCase()));
  return key({
    key: keyPart.length === 1 ? keyPart.toLowerCase() : keyPart,
    metaKey: modifiers.has('cmdorctrl') && primary === 'metaKey',
    ctrlKey: modifiers.has('cmdorctrl') && primary === 'ctrlKey',
    shiftKey: modifiers.has('shift'),
    altKey: modifiers.has('optionoralt'),
  });
}
