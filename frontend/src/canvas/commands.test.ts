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

function fourInARow() {
  const initial: SceneData = {
    elements: ['a', 'b', 'c', 'd'].map((id, i) => ({ id, type: 'rect', x: i * 20, y: 0, w: 10, h: 10, z: i + 1 })) as never,
  };
  const history = createHistory(initial);
  const selection = createSelection();
  return { history, selection, commands: createCanvasCommands({ history, selection }) };
}

describe('arranging one step at a time', () => {
  it('brings forward past the next element up', () => {
    const { history, selection, commands } = fourInARow();
    selection.click('b');
    commands.bringForward();
    expect(ids(history.current)).toEqual(['a', 'c', 'b', 'd']);
    commands.undo();
    expect(ids(history.current)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sends backward past the next element down', () => {
    const { history, selection, commands } = fourInARow();
    selection.click('c');
    commands.sendBackward();
    expect(ids(history.current)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('moves a selection together, keeping its own order', () => {
    const { history, selection, commands } = fourInARow();
    selection.click('b');
    selection.click('c', { additive: true });
    commands.bringForward();
    expect(ids(history.current)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('records nothing when already at the end', () => {
    const { history, selection, commands } = fourInARow();
    selection.click('d');
    commands.bringForward();
    selection.click('a');
    commands.sendBackward();
    expect(history.canUndo).toBe(false);
  });
});

describe('duplicating', () => {
  it('copies the selection offset, selects the copies, in one step', () => {
    const { history, selection, commands } = setup();
    selection.click('a');
    commands.duplicate();
    expect(history.current.elements).toHaveLength(4);
    const copy = history.current.elements.find((e) => e.id === selection.ids[0])!;
    expect(copy.id).not.toBe('a');
    expect(copy).toMatchObject({ type: 'rect', x: 16, y: 16, w: 10, h: 10 });
    commands.undo();
    expect(history.current.elements).toHaveLength(3);
  });

  it('duplicates a group with its children under new ids', () => {
    const { history, selection, commands } = setup();
    selection.click('a');
    selection.click('b', { additive: true });
    commands.group();
    commands.duplicate();
    const copyGroup = history.current.elements.find((e) => e.id === selection.ids[0]) as { children: string[] };
    expect(copyGroup.children).toHaveLength(2);
    expect(copyGroup.children).not.toContain('a');
    expect(copyGroup.children).not.toContain('b');
    for (const child of copyGroup.children) {
      expect(history.current.elements.some((e) => e.id === child)).toBe(true);
    }
  });
});

describe('flipping', () => {
  it('mirrors positions across the selection bounds, horizontally', () => {
    const { history, selection, commands } = setup();
    selection.click('a');
    selection.click('c', { additive: true });
    commands.flipHorizontal();
    const byId = Object.fromEntries(history.current.elements.map((e) => [e.id, e]));
    // Bounds 0..50: a (0..10) goes to 40..50, c (40..50) to 0..10.
    expect(byId.a.x).toBe(40);
    expect(byId.c.x).toBe(0);
  });

  it("mirrors a line's points within its box", () => {
    const history = createHistory({
      elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 30, h: 10, z: 1, points: [0, 0, 30, 10] } as never],
    });
    const selection = createSelection();
    const commands = createCanvasCommands({ history, selection });
    selection.click('l');
    commands.flipVertical();
    expect((history.current.elements[0] as unknown as { points: number[] }).points).toEqual([0, 10, 30, 0]);
  });
});

describe('aligning and distributing the selection', () => {
  it('aligns in one step, a group moving as one unit with its children', () => {
    const { history, selection, commands } = fourInARow();
    selection.click('a');
    selection.click('b', { additive: true });
    commands.group();
    const groupId = selection.ids[0];
    selection.click(groupId);
    selection.click('d', { additive: true });
    const stepsBefore = history.canUndo;
    commands.align('right');
    const byId = Object.fromEntries(history.current.elements.map((e) => [e.id, e]));
    // Bounds 0..70. The group (0..30) moves right by 40: a to 40, b to 60.
    expect(byId.a.x).toBe(40);
    expect(byId.b.x).toBe(60);
    expect(byId[groupId].x).toBe(40);
    expect(byId.d.x).toBe(60);
    expect(stepsBefore).toBe(true);
    commands.undo();
    expect(history.current.elements.find((e) => e.id === 'a')!.x).toBe(0);
  });

  it('distributes three', () => {
    const { history, selection, commands } = fourInARow();
    selection.click('a');
    selection.click('b', { additive: true });
    selection.click('d', { additive: true });
    commands.distribute('horizontal');
    const b = history.current.elements.find((e) => e.id === 'b')!;
    expect(b.x).toBe(30);
  });
});

describe('copying and pasting styles', () => {
  it('copies the first selected element and pastes onto the selection', () => {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 1, fill: 'blue' },
        { id: 'b', type: 'rect', x: 5, y: 0, w: 1, h: 1, z: 2 },
      ] as never,
    });
    const selection = createSelection();
    const commands = createCanvasCommands({ history, selection });
    selection.click('a');
    commands.copyStyles();
    selection.click('b');
    commands.pasteStyles();
    expect(history.current.elements[1]).toMatchObject({ fill: 'blue' });
  });

  it('pastes nothing before anything was copied', () => {
    const { history, selection, commands } = setup();
    selection.click('a');
    commands.pasteStyles();
    expect(history.canUndo).toBe(false);
  });
});

// Select All and a marquee select a group together with its children. Each
// unit must still move, flip or copy once.
describe('a group selected with its children', () => {
  function groupAndOutsider() {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
        { id: 'b', type: 'rect', x: 20, y: 0, w: 10, h: 10, z: 2 },
        { id: 'g', type: 'group', x: 0, y: 0, w: 30, h: 10, z: 3, children: ['a', 'b'] },
        { id: 'd', type: 'rect', x: 60, y: 0, w: 10, h: 10, z: 4 },
      ] as never,
    });
    const selection = createSelection();
    const commands = createCanvasCommands({ history, selection });
    commands.selectAll();
    return { history, selection, commands };
  }
  const x = (history: ReturnType<typeof createHistory>, id: string) => history.current.elements.find((e) => e.id === id)!.x;

  it('aligns each unit once', () => {
    const { history, commands } = groupAndOutsider();
    commands.align('right');
    expect([x(history, 'a'), x(history, 'b'), x(history, 'g'), x(history, 'd')]).toEqual([40, 60, 40, 60]);
  });

  it('flips each unit once', () => {
    const { history, commands } = groupAndOutsider();
    commands.flipHorizontal();
    // Bounds 0..70: the group (0..30) mirrors to 40..70, its children with it.
    expect([x(history, 'a'), x(history, 'b'), x(history, 'd')]).toEqual([60, 40, 0]);
  });

  it('duplicates each element once', () => {
    const { history, commands } = groupAndOutsider();
    commands.duplicate();
    expect(history.current.elements).toHaveLength(8);
  });

  it('records one step for an align, undone by one undo', () => {
    const { history, commands } = groupAndOutsider();
    expect(history.canUndo).toBe(false);
    commands.align('right');
    commands.undo();
    expect(history.canUndo).toBe(false);
    expect(x(history, 'a')).toBe(0);
  });
});

// New elements took z = count + 1, which repeats a z once anything has been
// deleted. Stepping then swapped equal values and nothing moved.
describe('arranging elements that share a z', () => {
  it('still moves one step', () => {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 2 },
        { id: 'b', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 2 },
        { id: 'c', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 3 },
      ] as never,
    });
    const selection = createSelection();
    const commands = createCanvasCommands({ history, selection });
    selection.click('a');
    commands.bringForward();
    expect(ids(history.current)).toEqual(['b', 'a', 'c']);
    const z = history.current.elements.map((e) => e.z);
    expect(new Set(z).size).toBe(3);
  });

  // A group draws nothing; its children are what the user sees move.
  it('moves a grouped child past a visible neighbour, not past its own group', () => {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
        { id: 'g', type: 'group', x: 0, y: 0, w: 10, h: 10, z: 2, children: ['a'] },
        { id: 'c', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 3 },
      ] as never,
    });
    const selection = createSelection();
    const commands = createCanvasCommands({ history, selection });
    selection.click('a');
    commands.bringForward();
    const order = ids(history.current).filter((id) => id !== 'g');
    expect(order).toEqual(['c', 'a']);
  });
});

describe('what can be pasted', () => {
  it('reports elements and styles to paste once something was copied', () => {
    const { selection, commands } = setup();
    expect(commands.canPaste).toBe(false);
    expect(commands.canPasteStyles).toBe(false);
    selection.click('a');
    commands.copy();
    commands.copyStyles();
    expect(commands.canPaste).toBe(true);
    expect(commands.canPasteStyles).toBe(true);
  });
});

// An edit rewrites an element; keys this Bava does not model must ride along.
describe('editing an element with keys we do not model', () => {
  it('keeps them through a move, an align and a duplicate', () => {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1, glow: true, strokeWidth: 4 },
        { id: 'b', type: 'rect', x: 40, y: 20, w: 10, h: 10, z: 2, glow: false },
      ] as never,
    });
    const selection = createSelection();
    const commands = createCanvasCommands({ history, selection });
    commands.selectAll();
    commands.align('left');
    commands.duplicate();
    for (const element of history.current.elements) {
      expect(element, JSON.stringify(element)).toHaveProperty('glow');
    }
    expect(history.current.elements.find((e) => e.id === 'a')).toMatchObject({ strokeWidth: 4 });
  });
});

describe('locking', () => {
  it('locks the selection, and unlock all frees every locked element', () => {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
        { id: 'b', type: 'rect', x: 20, y: 0, w: 10, h: 10, z: 2, locked: true },
      ] as never,
    });
    const selection = createSelection();
    const commands = createCanvasCommands({ history, selection });
    selection.click('a');
    commands.lock();
    expect(history.current.elements[0]).toMatchObject({ locked: true });
    // Locking clears the selection: a locked element cannot be selected.
    expect(selection.ids).toEqual([]);
    expect(commands.hasLocked).toBe(true);

    commands.unlockAll();
    expect(history.current.elements.every((e) => !('locked' in e))).toBe(true);
    expect(commands.hasLocked).toBe(false);
    commands.undo();
    expect(history.current.elements.filter((e) => 'locked' in e)).toHaveLength(2);
  });
});

// Align lines up what the user sees: a rotated element's edge on screen, not
// the edge of the box it is stored as.
describe('aligning a rotated element', () => {
  it('uses its drawn bounds', () => {
    const { history, selection, commands } = setup();
    history.mutate((scene) => {
      scene.elements.push(
        // Turned a quarter, this bar is drawn from x 40 to 60.
        { id: 'bar', type: 'rect', x: 0, y: 40, w: 100, h: 20, z: 4, angle: 90 } as never,
        { id: 'box', type: 'rect', x: 200, y: 0, w: 20, h: 20, z: 5 } as never,
      );
    });
    selection.click('bar');
    selection.click('box', { additive: true });
    commands.align('left');
    const moved = history.current.elements.find((e) => e.id === 'box')!;
    expect(moved.x).toBe(40);
  });
});

// Deleting a container must not delete work the user did not select: the
// contents stay, and stop claiming a frame that is gone.
describe('deleting a frame', () => {
  it('keeps its contents and clears their frame', () => {
    const { history, selection, commands } = setup();
    history.mutate((scene) => {
      scene.elements.push(
        { id: 'f', type: 'frame', x: 0, y: 0, w: 200, h: 200, z: 4 } as never,
        { id: 'in', type: 'rect', x: 20, y: 20, w: 40, h: 40, z: 5, frame: 'f' } as never,
      );
    });
    selection.click('f');
    commands.deleteSelection();

    const ids = history.current.elements.map((e) => e.id);
    expect(ids).not.toContain('f');
    expect(ids).toContain('in');
    expect(history.current.elements.find((e) => e.id === 'in')).not.toHaveProperty('frame');
  });
});

// A diagram inserted from code is one step, selected on arrival, and made of
// ordinary elements from then on.
describe('inserting a diagram', () => {
  const pair = () => [
    { id: 'x1', type: 'rect', x: 0, y: 0, w: 40, h: 40, z: 1, label: 'A' },
    { id: 'x2', type: 'rect', x: 100, y: 0, w: 40, h: 40, z: 2, label: 'B' },
    { id: 'x3', type: 'arrow', x: 40, y: 20, w: 60, h: 0, z: 3, points: [0, 0, 60, 0], startBinding: 'x1', endBinding: 'x2' },
  ] as never[];

  it('adds every element in one undoable step', () => {
    const { history, commands } = setup();
    const before = history.current.elements.length;
    commands.insertDiagram(pair());
    expect(history.current.elements).toHaveLength(before + 3);
    history.undo();
    expect(history.current.elements).toHaveLength(before);
  });

  it('selects what it inserted, so it can be moved straight away', () => {
    const { selection, commands } = setup();
    commands.insertDiagram(pair());
    expect(selection.ids.sort()).toEqual(['x1', 'x2', 'x3']);
  });

  it('gives the arrivals ids that do not collide with the scene', () => {
    const { history, commands } = setup();
    commands.insertDiagram([{ id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 }] as never[]);
    const ids = history.current.elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('paints them above what is already there', () => {
    const { history, commands } = setup();
    const top = Math.max(...history.current.elements.map((e) => e.z));
    commands.insertDiagram(pair());
    const arrived = history.current.elements.filter((e) => e.id.startsWith('x'));
    for (const element of arrived) expect(element.z).toBeGreaterThan(top);
  });

  // The arrows arrive attached, so the re-route in `mutate` aims them at once.
  it('aims the arrows as they land', () => {
    const { history, commands } = setup();
    commands.insertDiagram(pair());
    const arrow = history.current.elements.find((e) => e.id === 'x3') as { x: number; points: number[] };
    // The gap means it starts clear of A's right edge, not on it.
    expect(arrow.x + arrow.points[0]).toBeGreaterThan(40);
  });

  it('does nothing at all for an empty diagram', () => {
    const { history, commands } = setup();
    const before = history.current.elements.length;
    commands.insertDiagram([]);
    expect(history.current.elements).toHaveLength(before);
    expect(history.canUndo).toBe(false);
  });

  it('keeps a diagram group pointing at its own children when an id collides', () => {
    const { history, commands } = setup();
    // 'a' already exists in the scene, so the arrival is renamed.
    commands.insertDiagram([
      { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
      { id: 'gg', type: 'group', x: 0, y: 0, w: 10, h: 10, z: 2, children: ['a'] },
    ] as never[]);

    const group = history.current.elements.find((e) => e.type === 'group') as { children: string[] };
    const present = new Set(history.current.elements.map((e) => e.id));
    for (const child of group.children) expect(present.has(child)).toBe(true);
    // Not the scene's own 'a', which was there before the insert.
    expect(group.children).not.toContain('a');
  });
});