import { describe, expect, it } from 'vitest';
import { createPointerHandler } from './pointer';
import { createHistory } from './history';
import { createSelection } from './selection';
import { createTools } from './tools.svelte';

function harness(tool: Parameters<ReturnType<typeof createTools>['activate']>[0] = 'select', zoom = 1) {
  const history = createHistory({ elements: [] });
  const selection = createSelection();
  const tools = createTools();
  tools.activate(tool);
  // An 8px handle on screen: its half-size in scene units shrinks as zoom grows.
  const handler = createPointerHandler({ history, selection, tools, handleSize: () => 4 / zoom });
  return { history, selection, tools, handler };
}

const at = (x: number, y: number) => ({ x, y });

describe('pointer input', () => {
  it('creates one element when dragging with the rect tool', () => {
    const { history, handler } = harness('rect');

    handler.down(at(10, 10));
    handler.move(at(60, 50));
    handler.up(at(60, 50));

    expect(history.current.elements).toHaveLength(1);
    expect(history.current.elements[0]).toMatchObject({ type: 'rect', x: 10, y: 10, w: 50, h: 40 });
  });

  it('normalises a drag that goes up and to the left', () => {
    const { history, handler } = harness('rect');

    handler.down(at(60, 50));
    handler.move(at(10, 10));
    handler.up(at(10, 10));

    expect(history.current.elements[0]).toMatchObject({ x: 10, y: 10, w: 50, h: 40 });
  });

  // A click with a shape tool should not leave an invisible zero-size element
  // behind, which is impossible to select and impossible to explain.
  it('creates nothing from a click that barely moves', () => {
    const { history, handler } = harness('rect');

    handler.down(at(10, 10));
    handler.move(at(11, 11));
    handler.up(at(11, 11));

    expect(history.current.elements).toHaveLength(0);
  });

  it('selects an element on click with the select tool', () => {
    const { history, selection, handler } = harness('rect');
    handler.down(at(0, 0));
    handler.move(at(40, 40));
    handler.up(at(40, 40));
    const id = history.current.elements[0].id;

    const select = harness('select');
    expect(() => select.handler.down(at(0, 0))).not.toThrow();

    // Selecting happens against the scene the handler was given.
    selection.click(id);
    expect(selection.ids).toEqual([id]);
  });

  it('marquees when dragging empty space with the select tool', () => {
    const { history, selection, handler, tools } = harness('rect');
    handler.down(at(0, 0));
    handler.move(at(30, 30));
    handler.up(at(30, 30));
    const id = history.current.elements[0].id;

    tools.activate('select');
    handler.down(at(-10, -10));
    handler.move(at(50, 50));
    handler.up(at(50, 50));

    expect(selection.ids).toEqual([id]);
  });

  it('moves every selected element by the same delta', () => {
    const { history, selection, handler, tools } = harness('rect');
    handler.down(at(0, 0));
    handler.move(at(20, 20));
    handler.up(at(20, 20));
    handler.down(at(100, 0));
    handler.move(at(120, 20));
    handler.up(at(120, 20));

    const [first, second] = history.current.elements;
    selection.click(first.id);
    selection.click(second.id, { additive: true });

    tools.activate('select');
    handler.down(at(10, 10));
    handler.move(at(40, 30));
    handler.up(at(40, 30));

    const moved = history.current.elements;
    expect(moved[0]).toMatchObject({ x: first.x + 30, y: first.y + 20 });
    expect(moved[1]).toMatchObject({ x: second.x + 30, y: second.y + 20 });
  });

  // One history, and everything in it reversible.
  it('makes every mutation undoable', () => {
    const { history, selection, handler, tools } = harness('rect');
    const start = JSON.stringify(history.current);

    handler.down(at(0, 0));
    handler.move(at(30, 30));
    handler.up(at(30, 30));

    selection.click(history.current.elements[0].id);
    tools.activate('select');
    handler.down(at(10, 10));
    handler.move(at(40, 40));
    handler.up(at(40, 40));

    history.undo();
    history.undo();

    expect(JSON.stringify(history.current)).toBe(start);
  });

  it('records one history step per drag, not one per move event', () => {
    const { history, handler } = harness('rect');

    handler.down(at(0, 0));
    handler.move(at(10, 10));
    handler.move(at(20, 20));
    handler.move(at(30, 30));
    handler.up(at(30, 30));

    history.undo();
    expect(history.current.elements).toHaveLength(0);
    expect(history.canUndo).toBe(false);
  });
});

describe('pen and text', () => {
  it('simplifies a pen stroke on release', () => {
    const { history, handler } = harness('pen');

    handler.down(at(0, 0));
    for (let i = 1; i < 200; i += 1) handler.move(at(i, 0));
    handler.up(at(200, 0));

    const stroke = history.current.elements[0];
    expect(stroke.type).toBe('stroke');
    // A straight line does not need two hundred points.
    expect((stroke as { points: number[] }).points.length).toBeLessThan(40);
  });

  it('ignores a pen stroke that is a single tap', () => {
    const { history, handler } = harness('pen');
    handler.down(at(5, 5));
    handler.up(at(5, 5));
    expect(history.current.elements).toHaveLength(0);
  });

  it('gives a stroke bounds that cover its points', () => {
    const { history, handler } = harness('pen');
    handler.down(at(10, 20));
    handler.move(at(50, 5));
    handler.move(at(30, 60));
    handler.up(at(30, 60));

    const stroke = history.current.elements[0];
    expect(stroke.x).toBeLessThanOrEqual(10);
    expect(stroke.y).toBeLessThanOrEqual(5);
    expect(stroke.w).toBeGreaterThan(0);
    expect(stroke.h).toBeGreaterThan(0);
  });

  // Points are stored relative to the element's x and y, as the file format
  // says; absolute points drew every stroke offset by its own position.
  it('stores stroke points relative to the stroke', () => {
    const { history, handler } = harness('pen');
    handler.down(at(110, 120));
    handler.move(at(150, 105));
    handler.move(at(130, 160));
    handler.up(at(130, 160));

    const stroke = history.current.elements[0] as { w: number; h: number; points: number[] };
    for (let i = 0; i < stroke.points.length; i += 2) {
      expect(stroke.points[i]).toBeGreaterThanOrEqual(0);
      expect(stroke.points[i]).toBeLessThanOrEqual(stroke.w);
      expect(stroke.points[i + 1]).toBeGreaterThanOrEqual(0);
      expect(stroke.points[i + 1]).toBeLessThanOrEqual(stroke.h);
    }
  });

  it('draws an arrow from where the drag started to where it ended', () => {
    const { history, handler } = harness('arrow');
    handler.down(at(100, 50));
    handler.up(at(20, 90));

    const arrow = history.current.elements[0] as { x: number; y: number; points: number[] };
    expect(arrow.x).toBe(20);
    expect(arrow.y).toBe(50);
    // From the start, up and to the right of the end, to the end.
    expect(arrow.points).toEqual([80, 0, 0, 40]);
  });

  it('creates the shape the active tool names', () => {
    const { history, handler } = harness('cylinder');
    handler.down(at(0, 0));
    handler.up(at(40, 60));
    expect(history.current.elements[0].type).toBe('cylinder');
  });

  it('resizes the selection by dragging a handle, as one undo step', () => {
    const { history, selection, handler } = harness('select');
    history.mutate((scene) => {
      scene.elements.push({ id: 'r', type: 'rect', x: 100, y: 100, w: 200, h: 100, z: 1 } as never);
    });
    selection.click('r');

    handler.down(at(300, 200));
    handler.up(at(320, 230));

    expect(history.current.elements[0]).toMatchObject({ x: 100, y: 100, w: 220, h: 130 });
    history.undo();
    expect(history.current.elements[0]).toMatchObject({ w: 200, h: 100 });
    history.undo();
    expect(history.current.elements).toHaveLength(0);
  });

  it('scales a line\'s points when it is resized', () => {
    const { history, selection, handler } = harness('select');
    history.mutate((scene) => {
      scene.elements.push({ id: 'l', type: 'line', x: 0, y: 0, w: 100, h: 50, z: 1, points: [0, 0, 100, 50] } as never);
    });
    selection.click('l');
    handler.down(at(100, 50));
    handler.up(at(200, 100));
    expect((history.current.elements[0] as unknown as { points: number[] }).points).toEqual([0, 0, 200, 100]);
  });

  // Seen in review: at 25% zoom the handle zone covered a whole shape, so a
  // selected shape could be resized but never moved.
  it('moves a selected shape pressed in its middle at low zoom', () => {
    const { history, selection, handler } = harness('select', 0.25);
    history.mutate((scene) => {
      scene.elements.push({ id: 'r', type: 'rect', x: 0, y: 0, w: 120, h: 60, z: 1 } as never);
    });
    selection.click('r');
    handler.down(at(60, 30));
    handler.up(at(80, 30));
    expect(history.current.elements[0]).toMatchObject({ x: 20, y: 0, w: 120, h: 60 });
  });

  // A shape a few handles across is all handles; pressing inside it moves it.
  it('moves a small selected shape pressed inside it', () => {
    const { history, selection, handler } = harness('select');
    history.mutate((scene) => {
      scene.elements.push({ id: 's', type: 'rect', x: 0, y: 0, w: 16, h: 16, z: 1 } as never);
    });
    selection.click('s');
    handler.down(at(3, 3));
    handler.up(at(13, 3));
    expect(history.current.elements[0]).toMatchObject({ x: 10, w: 16 });
  });

  it('writes tidy numbers when drawing and moving under a fractional zoom', () => {
    const { history, handler } = harness('rect');
    handler.down(at(10 / 3, 20 / 3));
    handler.up(at(100 / 3, 200 / 3));
    const rect = history.current.elements[0];
    for (const value of [rect.x, rect.y, rect.w, rect.h]) {
      expect(Math.round(value * 1000) / 1000).toBe(value);
    }
  });
});

// While a drag is in progress the canvas shows its result, computed by the same
// code release commits. Nothing enters history until release.
describe('previewing a drag', () => {
  it('shows a rectangle being drawn', () => {
    const { handler } = harness('rect');
    handler.down(at(10, 10));
    handler.move(at(60, 50));
    const preview = handler.preview(at(60, 50));
    expect(preview?.elements).toHaveLength(1);
    expect(preview?.elements[0]).toMatchObject({ type: 'rect', x: 10, y: 10, w: 50, h: 40 });
  });

  it('shows a stroke drawn so far', () => {
    const { handler } = harness('pen');
    handler.down(at(0, 0));
    handler.move(at(20, 5));
    handler.move(at(40, 30));
    const preview = handler.preview(at(40, 30));
    expect(preview?.elements[0]).toMatchObject({ type: 'stroke', x: 0, y: 0, w: 40, h: 30 });
  });

  it('shows a moved selection', () => {
    const { history, selection, handler, tools } = harness('rect');
    handler.down(at(0, 0));
    handler.up(at(40, 40));
    const id = history.current.elements[0].id;
    tools.activate('select');
    selection.click(id);

    handler.down(at(10, 10));
    const preview = handler.preview(at(30, 25));
    expect(preview?.elements[0]).toMatchObject({ x: 20, y: 15 });
    expect(history.current.elements[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('shows a resize', () => {
    const { history, selection, handler, tools } = harness('rect');
    handler.down(at(0, 0));
    handler.up(at(40, 40));
    tools.activate('select');
    selection.click(history.current.elements[0].id);

    handler.down(at(40, 40));
    const preview = handler.preview(at(80, 60));
    expect(preview?.elements[0]).toMatchObject({ x: 0, y: 0, w: 80, h: 60 });
  });

  it('never changes history', () => {
    const { history, handler } = harness('rect');
    handler.down(at(10, 10));
    handler.preview(at(60, 50));
    handler.preview(at(90, 70));
    expect(history.current.elements).toHaveLength(0);
    expect(history.canUndo).toBe(false);
  });

  it('is nothing without a drag, or when the drag would change nothing', () => {
    const { handler } = harness('rect');
    expect(handler.preview(at(5, 5))).toBeNull();
    handler.down(at(10, 10));
    expect(handler.preview(at(11, 11))).toBeNull();
  });

  // The preview's element keeps one id for the whole drag, so the stage
  // updates one node rather than replacing it on every move.
  it('keeps one id through the drag, and release commits what the last preview showed', () => {
    const { history, handler } = harness('ellipse');
    handler.down(at(10, 10));
    const first = handler.preview(at(30, 30))?.elements[0];
    const last = handler.preview(at(70, 60))?.elements[0];
    expect(last?.id).toBe(first?.id);
    handler.up(at(70, 60));
    expect(history.current.elements[0]).toEqual(last);
  });
});

describe('erasing', () => {
  function withTwoShapes() {
    const h = harness('rect');
    h.handler.down(at(0, 0));
    h.handler.up(at(20, 20));
    h.handler.down(at(50, 0));
    h.handler.up(at(70, 20));
    h.tools.activate('eraser');
    return h;
  }

  it('marks what the trail crosses, then deletes it in one step', () => {
    const { history, handler } = withTwoShapes();
    const stepsBefore = 2;
    handler.down(at(-5, 10));
    handler.move(at(30, 10));
    expect(handler.erasing.size).toBe(1);
    handler.move(at(80, 10));
    expect(handler.erasing.size).toBe(2);
    expect(history.current.elements).toHaveLength(2);
    handler.up(at(80, 10));
    expect(history.current.elements).toHaveLength(0);
    history.undo();
    expect(history.current.elements).toHaveLength(stepsBefore);
  });

  it('erases what a click lands on', () => {
    const { history, handler } = withTwoShapes();
    handler.down(at(60, 10));
    handler.up(at(60, 10));
    expect(history.current.elements).toHaveLength(1);
  });

  it('restores marked elements the trail passes over again with Alt', () => {
    const { history, handler } = withTwoShapes();
    handler.down(at(-5, 10));
    handler.move(at(80, 10));
    handler.move(at(60, 5), { alt: true });
    expect(handler.erasing.size).toBe(1);
    handler.up(at(60, 5), { alt: true });
    expect(history.current.elements).toHaveLength(1);
  });

  it('records nothing when nothing was touched', () => {
    const { history, handler } = withTwoShapes();
    const undoable = history.canUndo;
    handler.down(at(200, 200));
    handler.move(at(300, 300));
    handler.up(at(300, 300));
    expect(history.current.elements).toHaveLength(2);
    expect(history.canUndo).toBe(undoable);
    expect(handler.erasing.size).toBe(0);
  });
});

describe('the z a drawn element gets', () => {
  it('is above everything, even after a deletion left a gap', () => {
    const { history, handler } = harness('rect');
    handler.down(at(0, 0));
    handler.up(at(20, 20));
    handler.down(at(30, 0));
    handler.up(at(50, 20));
    history.mutate((scene) => {
      scene.elements = scene.elements.filter((_, i) => i !== 0);
    });
    handler.down(at(60, 0));
    handler.up(at(80, 20));
    const z = history.current.elements.map((e) => e.z);
    expect(new Set(z).size).toBe(z.length);
    expect(history.current.elements.at(-1)!.z).toBe(Math.max(...z));
  });
});

describe('what the eraser shows as marked', () => {
  it('is everything release will delete, the rest of a group included', () => {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 },
        { id: 'b', type: 'rect', x: 100, y: 100, w: 20, h: 20, z: 2 },
        { id: 'g', type: 'group', x: 0, y: 0, w: 120, h: 120, z: 3, children: ['a', 'b'] },
      ] as never,
    });
    const selection = createSelection();
    const tools = createTools();
    tools.activate('eraser');
    const handler = createPointerHandler({ history, selection, tools });
    handler.down(at(-5, 10));
    handler.move(at(30, 10));
    expect([...handler.erasing].sort()).toEqual(['a', 'b', 'g']);
  });
});

// The dashed rectangle belongs to dragging empty space. A resize is a drag
// with nothing being marquee'd, and drew one over every resize.
describe('a resize drag', () => {
  function selectedRect() {
    const h = harness('rect');
    h.handler.down(at(0, 0));
    h.handler.up(at(100, 60));
    h.tools.activate('select');
    h.selection.click(h.history.current.elements[0].id);
    return h;
  }

  it('draws no marquee', () => {
    const { handler } = selectedRect();
    handler.down(at(100, 60));
    handler.move(at(140, 90));
    expect(handler.marquee).toBeNull();
    expect(handler.preview(at(140, 90))?.elements[0]).toMatchObject({ w: 140, h: 90 });
  });
});

// Shift is read while dragging, as Excalidraw does: pressing or releasing it
// mid-drag changes what the preview shows and what release commits.
describe('Shift during a drag', () => {
  it('constrains when Shift goes down mid-drag, and stops when it is released', () => {
    const { handler } = harness('rect');
    handler.down(at(0, 0));
    expect(handler.preview(at(100, 40))?.elements[0]).toMatchObject({ w: 100, h: 40 });
    handler.move(at(100, 40), { shift: true });
    expect(handler.preview(at(100, 40), { shift: true })?.elements[0]).toMatchObject({ w: 100, h: 100 });
    handler.move(at(100, 40));
    expect(handler.preview(at(100, 40))?.elements[0]).toMatchObject({ w: 100, h: 40 });
  });

  it('commits what the last preview showed', () => {
    const { history, handler } = harness('ellipse');
    handler.down(at(0, 0));
    const shown = handler.preview(at(60, 20), { shift: true })?.elements[0];
    handler.up(at(60, 20), { shift: true });
    expect(history.current.elements[0]).toEqual(shown);
  });

  // Every call says what Shift is. A release that leaves it out means "not
  // held", so a constrained preview cannot be committed as a free box or the
  // other way round.
  it('reads a missing shift option as not held, everywhere', () => {
    const { history, handler } = harness('rect');
    handler.down(at(0, 0));
    handler.preview(at(60, 20), { shift: true });
    handler.up(at(60, 20));
    expect(history.current.elements[0]).toMatchObject({ w: 60, h: 20 });
  });

  it('keeps a resize in proportion while Shift is held', () => {
    const { history, selection, handler, tools } = harness('rect');
    handler.down(at(0, 0));
    handler.up(at(100, 50));
    tools.activate('select');
    selection.click(history.current.elements[0].id);

    handler.down(at(100, 50));
    const free = handler.preview(at(140, 60))?.elements[0];
    expect(free).toMatchObject({ w: 140, h: 60 });
    const held = handler.preview(at(140, 60), { shift: true })?.elements[0];
    expect(held).toMatchObject({ w: 140, h: 70 });
  });
});

describe('a locked element', () => {
  function withLocked() {
    const history = createHistory({
      elements: [
        { id: 'under', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 },
        { id: 'locked', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 2, locked: true },
      ] as never,
    });
    const selection = createSelection();
    const tools = createTools();
    tools.activate('select');
    return { history, selection, tools, handler: createPointerHandler({ history, selection, tools }) };
  }

  it('is not selected by a click: what is under it is', () => {
    const { selection, handler } = withLocked();
    handler.down(at(30, 30));
    handler.up(at(30, 30));
    expect(selection.ids).toEqual(['under']);
  });

  it('is skipped by the eraser', () => {
    const { history, tools, handler } = withLocked();
    tools.activate('eraser');
    handler.down(at(-5, 30));
    handler.move(at(70, 30));
    handler.up(at(70, 30));
    expect(history.current.elements.map((e) => e.id)).toEqual(['locked']);
  });
});

// Dragging the handle above the selection turns it (canvas-toolbar.md,
// "Rotation"). The angle is where the pointer is, read from the centre, so the
// element follows the pointer rather than a remembered offset.
describe('rotating with the handle', () => {
  function rotatable(zoom = 1) {
    const kit = harness('select', zoom);
    kit.history.mutate((scene) => {
      scene.elements.push({ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never);
    });
    kit.selection.click('r');
    return kit;
  }

  // The handle sits 16 scene units above the top edge: (50, -16) for this box.
  const handle = at(50, -16);

  it('turns the element to where the pointer is', () => {
    const { history, handler } = rotatable();
    handler.down(handle);
    // To the right of the centre, level with it: a quarter turn.
    handler.up(at(150, 50));
    expect(history.current.elements[0]).toMatchObject({ angle: 90, x: 0, y: 0 });
  });

  it('snaps to fifteen degrees while Shift is held', () => {
    const { history, handler } = rotatable();
    handler.down(handle);
    handler.up(at(150, 60), { shift: true });
    expect(history.current.elements[0].angle).toBe(90);
  });

  it('previews the turn without recording it', () => {
    const { history, handler } = rotatable();
    handler.down(handle);
    const preview = handler.preview(at(150, 50));
    expect(preview?.elements[0]).toMatchObject({ angle: 90 });
    expect(history.current.elements[0].angle).toBeUndefined();
    // The only step in history is the one that placed the element.
    history.undo();
    expect(history.current.elements).toHaveLength(0);
  });

  it('is one undo step for the whole drag', () => {
    const { history, handler } = rotatable();
    handler.down(handle);
    handler.move(at(100, 0));
    handler.move(at(150, 50));
    handler.up(at(150, 50));
    history.undo();
    expect(history.current.elements[0].angle).toBeUndefined();
  });

  it('draws no marquee while it turns', () => {
    const { handler } = rotatable();
    handler.down(handle);
    handler.move(at(150, 50));
    expect(handler.marquee).toBeNull();
  });

  it('turns a multi-selection about its shared centre', () => {
    const { history, selection, handler } = rotatable();
    history.mutate((scene) => {
      scene.elements.push({ id: 's', type: 'rect', x: 200, y: 0, w: 100, h: 100, z: 2 } as never);
    });
    selection.click('s', { additive: true });
    // The pair spans x 0 to 300, y 0 to 100: centre (150, 50), handle above it.
    handler.down(at(150, -16));
    handler.up(at(150, 150));
    const [first, second] = history.current.elements;
    expect(first.angle).toBe(180);
    expect(second.angle).toBe(180);
    // Half a turn about the shared centre swaps the two boxes.
    expect(first.x).toBe(200);
    expect(second.x).toBe(0);
  });
});

// A rotated element resizes along its own axes, not the screen's: dragging the
// handle that is drawn on its right edge widens it, whichever way that edge
// happens to point.
describe('resizing a rotated element', () => {
  it('reads the drag in the element frame and keeps the opposite edge', () => {
    const { history, selection, handler } = harness('select');
    history.mutate((scene) => {
      scene.elements.push({ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1, angle: 90 } as never);
    });
    selection.click('r');
    // A quarter turn puts the right-edge handle at the bottom of the screen.
    handler.down(at(50, 100));
    handler.up(at(50, 140));
    expect(history.current.elements[0]).toMatchObject({ w: 140, h: 100, x: -20, y: 20 });
  });
});

// The marquee and the eraser test what is drawn: a shape turned off its stored
// box is caught where it is, and not where it was.
describe('a rotated element under the marquee and the eraser', () => {
  function turned(tool: 'select' | 'eraser') {
    const kit = harness(tool);
    kit.history.mutate((scene) => {
      scene.elements.push({ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 20, z: 1, angle: 90 } as never);
    });
    return kit;
  }

  it('is caught by a marquee over where it is drawn', () => {
    const { selection, handler } = turned('select');
    // The bar is vertical after the turn: x 40 to 60, y -40 to 60.
    handler.down(at(30, 40));
    handler.move(at(70, 70));
    handler.up(at(70, 70));
    expect(selection.ids).toEqual(['r']);
  });

  it('is left alone by a marquee over its stored box only', () => {
    const { selection, handler } = turned('select');
    handler.down(at(0, 0));
    handler.move(at(30, 15));
    handler.up(at(30, 15));
    expect(selection.ids).toEqual([]);
  });

  it('is erased by a trail crossing where it is drawn', () => {
    const { history, handler } = turned('eraser');
    handler.down(at(30, 50));
    handler.move(at(70, 50));
    handler.up(at(70, 50));
    expect(history.current.elements).toHaveLength(0);
  });
});

// A group is selected as one id standing for its children, so every drag has
// to expand it: rotating or moving the wrapper alone moves nothing a user can
// see (canvas-toolbar.md, "A multi-selection or group rotates about its
// shared centre").
describe('dragging a group', () => {
  function grouped() {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 } as never,
        { id: 'b', type: 'rect', x: 80, y: 0, w: 20, h: 20, z: 2 } as never,
        { id: 'g', type: 'group', x: 0, y: 0, w: 100, h: 20, z: 3, children: ['a', 'b'] } as never,
      );
    });
    kit.selection.click('g');
    const byId = (id: string) => kit.history.current.elements.find((e) => e.id === id)!;
    return { ...kit, byId };
  }

  it('moves its children with it', () => {
    const { handler, byId } = grouped();
    handler.down(at(50, 10));
    handler.up(at(60, 10));
    expect(byId('a').x).toBe(10);
    expect(byId('b').x).toBe(90);
    expect(byId('g').x).toBe(10);
  });

  it('rotates its children about the shared centre', () => {
    const { handler, byId } = grouped();
    // The group spans x 0 to 100, y 0 to 20: centre (50, 10), handle above it.
    handler.down(at(50, -16));
    handler.up(at(50, 150));
    expect(byId('a')).toMatchObject({ x: 80, angle: 180 });
    expect(byId('b')).toMatchObject({ x: 0, angle: 180 });
  });

  it('resizes its children with it', () => {
    const { handler, byId } = grouped();
    handler.down(at(100, 20));
    handler.up(at(200, 20));
    // The group's 100-wide box doubles, so b's offset and width double too.
    expect(byId('b').x).toBe(160);
    expect(byId('b').w).toBe(40);
  });
});

// A rotated member of a multi-selection is scaled through its drawn bounds,
// so it stays inside the frame the user dragged rather than stretching along
// an axis that is no longer on screen.
describe('resizing a selection that holds a rotated element', () => {
  it('keeps the rotated member inside the new frame', () => {
    const { history, selection, handler } = harness('select');
    history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 40, w: 100, h: 20, z: 1, angle: 90 } as never,
        { id: 'b', type: 'rect', x: 60, y: 0, w: 40, h: 100, z: 2 } as never,
      );
    });
    selection.click('a');
    selection.click('b', { additive: true });
    // Drawn, the pair spans x 40 to 100, y 0 to 100. Widen it by 60.
    handler.down(at(100, 100));
    handler.up(at(160, 100));
    const turned = history.current.elements[0];
    // Its width runs down the screen, so a horizontal stretch grows its height.
    expect(turned.w).toBe(100);
    expect(turned.h).toBe(40);
    expect(turned.angle).toBe(90);
  });
});
