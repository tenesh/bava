import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import { createSelection } from './selection';
import { createCanvasCommands } from './commands';
import type { SceneData } from './scene';

function setup() {
  const initial: SceneData = {
    elements: [
      { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
      { id: 'b', type: 'rect', x: 20, y: 0, w: 10, h: 10, z: 2 },
      { id: 'c', type: 'rect', x: 40, y: 0, w: 10, h: 10, z: 3 },
    ],
  };
  const history = createHistory(initial);
  const selection = createSelection();
  return { history, selection, commands: createCanvasCommands({ history, selection }) };
}

const ids = (data: SceneData) => data.elements.map((e) => e.id);

describe('canvas commands', () => {
  it('deletes the selection as one undoable step', () => {
    const { history, selection, commands } = setup();
    selection.click('a');
    selection.click('b', { additive: true });
    commands.deleteSelection();
    expect(ids(history.current)).toEqual(['c']);
    expect(selection.ids).toEqual([]);
    commands.undo();
    expect(ids(history.current)).toEqual(['a', 'b', 'c']);
  });

  it('pastes what was copied, offset, and selects the copy', () => {
    const { history, selection, commands } = setup();
    selection.click('a');
    expect(commands.copy()).toBe(true);
    commands.paste();
    expect(history.current.elements).toHaveLength(4);
    const pasted = history.current.elements.find((e) => !['a', 'b', 'c'].includes(e.id))!;
    expect(pasted.x).toBeGreaterThan(0);
    expect(selection.ids).toEqual([pasted.id]);
  });

  it('copies nothing without a selection', () => {
    const { commands } = setup();
    expect(commands.copy()).toBe(false);
  });

  // Pasting an empty clipboard must not mark the document changed.
  it('reports an empty paste and records no history step', () => {
    const { history, commands } = setup();
    expect(commands.paste()).toBe(false);
    expect(history.canUndo).toBe(false);
  });

  it('cuts: copies, then deletes', () => {
    const { history, selection, commands } = setup();
    selection.click('c');
    expect(commands.cut()).toBe(true);
    expect(ids(history.current)).toEqual(['a', 'b']);
    commands.paste();
    expect(history.current.elements).toHaveLength(3);
  });

  it('groups the selection and selects the group; ungroup removes it', () => {
    const { history, selection, commands } = setup();
    selection.click('a');
    selection.click('b', { additive: true });
    commands.group();
    const group = history.current.elements.find((e) => e.type === 'group')!;
    expect(group).toBeDefined();
    expect(selection.ids).toEqual([group.id]);

    commands.ungroup();
    expect(history.current.elements.some((e) => e.type === 'group')).toBe(false);
  });

  it('brings to front and sends to back', () => {
    const { history, selection, commands } = setup();
    selection.click('a');
    commands.bringToFront();
    expect(ids(history.current).at(-1)).toBe('a');
    selection.click('c');
    commands.sendToBack();
    expect(ids(history.current)[0]).toBe('c');
  });

  it('selects everything', () => {
    const { selection, commands } = setup();
    commands.selectAll();
    expect(selection.ids).toEqual(['a', 'b', 'c']);
  });
});
