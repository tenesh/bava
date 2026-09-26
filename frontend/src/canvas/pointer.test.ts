import { describe, expect, it } from 'vitest';
import { createPointerHandler } from './pointer';
import { createHistory } from './history';
import { createSelection } from './selection';
import { createTools } from './tools.svelte';
import { labelPoint, routePoints } from './arrows';
import { drawnPathOf, pathBounds } from './hit';

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
    tools.activate('rect');
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
    // A drawn shape hands back to select; draw the second with the rect tool too.
    h.tools.activate('rect');
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
    const { history, handler, tools } = harness('rect');
    handler.down(at(0, 0));
    handler.up(at(20, 20));
    tools.activate('rect');
    handler.down(at(30, 0));
    handler.up(at(50, 20));
    history.mutate((scene) => {
      scene.elements = scene.elements.filter((_, i) => i !== 0);
    });
    tools.activate('rect');
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

// Drawing an arrow that starts or ends on a shape attaches it, as Excalidraw
// does, and Alt held during the drag leaves it free. The modifier is read on
// every move, never at the press (.ai/rules/canvas.md).
describe('attaching an arrow while drawing it', () => {
  function withShapes(tool: 'arrow' | 'line' = 'arrow') {
    const kit = harness(tool);
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 } as never,
        { id: 'b', type: 'rect', x: 200, y: 0, w: 60, h: 60, z: 2 } as never,
        { id: 'locked', type: 'rect', x: 0, y: 200, w: 60, h: 60, z: 3, locked: true } as never,
      );
    });
    const drawn = () => kit.history.current.elements.find((e) => e.type === 'arrow' || e.type === 'line');
    return { ...kit, drawn };
  }

  it('binds both ends when the drag starts and finishes on a shape', () => {
    const { handler, drawn } = withShapes();
    handler.down(at(30, 30));
    handler.move(at(230, 30));
    handler.up(at(230, 30));
    expect(drawn()).toMatchObject({ startBinding: 'a', endBinding: 'b' });
  });

  // Cmd/Ctrl leaves the ends free since 06.13 (Alt now pins them inside).
  // Since 06.15 (C19) the press decides the start, the release the end.
  it('binds nothing when Cmd/Ctrl is held', () => {
    const { handler, drawn } = withShapes();
    handler.down(at(30, 30), { mod: true });
    handler.move(at(230, 30), { mod: true });
    handler.up(at(230, 30), { mod: true });
    expect(drawn()!).not.toHaveProperty('startBinding');
    expect(drawn()!).not.toHaveProperty('endBinding');
  });

  it('binds again when Cmd/Ctrl is released before the end of the drag', () => {
    const { handler, drawn } = withShapes();
    handler.down(at(30, 30));
    handler.move(at(230, 30), { mod: true });
    handler.up(at(230, 30));
    expect(drawn()).toMatchObject({ startBinding: 'a', endBinding: 'b' });
  });

  it('offers the shape under each end as the candidate, for the stage to show', () => {
    const { handler } = withShapes();
    handler.down(at(30, 30));
    handler.move(at(230, 30));
    expect(handler.bindingCandidates).toEqual(['a', 'b']);
    // Cmd/Ctrl pressed mid-drag frees the end only: the start was decided at
    // the press (06.15, C19).
    handler.move(at(230, 30), { mod: true });
    expect(handler.bindingCandidates).toEqual(['a']);
  });

  it('never attaches to a locked shape', () => {
    const { handler, drawn } = withShapes();
    handler.down(at(30, 30));
    handler.move(at(30, 230));
    handler.up(at(30, 230));
    expect(drawn()).toMatchObject({ startBinding: 'a' });
    expect(drawn()!).not.toHaveProperty('endBinding');
  });

  // A line is not a connector: it is geometry, and carries no bindings.
  it('leaves a line unattached', () => {
    const { handler, drawn } = withShapes('line');
    handler.down(at(30, 30));
    handler.move(at(230, 30));
    handler.up(at(230, 30));
    expect(drawn()!).not.toHaveProperty('startBinding');
  });
});

// What the preview shows is what the release commits, bindings included.
describe('previewing a drag that moves an attached shape', () => {
  it('re-aims the arrow in the preview, not only on release', () => {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 } as never,
        { id: 'b', type: 'rect', x: 200, y: 0, w: 60, h: 60, z: 2 } as never,
        { id: 'arrow', type: 'arrow', x: 60, y: 30, w: 140, h: 0, z: 3, points: [0, 0, 140, 0], startBinding: 'a', endBinding: 'b' } as never,
      );
    });
    kit.selection.click('b');
    kit.handler.down(at(230, 30));
    const preview = kit.handler.preview(at(230, 300))!;
    const arrow = preview.elements.find((e) => e.id === 'arrow') as { y: number; points: number[] };
    expect(arrow.y + arrow.points[3]).toBeGreaterThan(30);
  });
});

// A selected arrow has a handle at each end: dragging one onto a shape
// attaches it, dragging it to empty canvas lets it go.
describe('dragging an arrow endpoint', () => {
  function withArrow(bindings: Record<string, string> = {}) {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 } as never,
        { id: 'b', type: 'rect', x: 200, y: 0, w: 60, h: 60, z: 2 } as never,
        {
          id: 'arrow',
          type: 'arrow',
          x: 100,
          y: 30,
          w: 60,
          h: 0,
          z: 3,
          points: [0, 0, 60, 0],
          ...bindings,
        } as never,
      );
    });
    kit.selection.click('arrow');
    const arrow = () => kit.history.current.elements.find((e) => e.id === 'arrow') as Record<string, unknown>;
    return { ...kit, arrow };
  }

  it('binds the end to the shape it is dropped on', () => {
    const { handler, arrow } = withArrow();
    // The far end sits at (160, 30); drag it into b.
    handler.down(at(160, 30));
    handler.move(at(230, 30));
    handler.up(at(230, 30));
    expect(arrow().endBinding).toBe('b');
  });

  it('lets an end go when it is dropped on empty canvas', () => {
    const { handler, arrow } = withArrow({ endBinding: 'b' });
    handler.down(at(196, 30));
    handler.move(at(400, 300));
    handler.up(at(400, 300));
    expect(arrow().endBinding).toBeUndefined();
    const points = arrow().points as number[];
    expect((arrow().x as number) + points[2]).toBe(400);
  });

  it('leaves the other end alone', () => {
    const { handler, arrow } = withArrow({ startBinding: 'a' });
    handler.down(at(160, 30));
    handler.move(at(230, 30));
    handler.up(at(230, 30));
    expect(arrow().startBinding).toBe('a');
  });

  it('does not bind while Cmd/Ctrl is held', () => {
    const { handler, arrow } = withArrow();
    handler.down(at(160, 30));
    handler.move(at(230, 30), { mod: true });
    handler.up(at(230, 30), { mod: true });
    expect(arrow().endBinding).toBeUndefined();
  });
});

// A frame owns what is dropped into it, and carries it when the frame moves
// (diagrams-as-shapes.md, "Containers own their contents").
describe('frames and their contents', () => {
  function withFrame() {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'f', type: 'frame', x: 0, y: 0, w: 200, h: 200, z: 1 } as never,
        { id: 'in', type: 'rect', x: 20, y: 20, w: 40, h: 40, z: 2, frame: 'f' } as never,
        { id: 'out', type: 'rect', x: 400, y: 0, w: 40, h: 40, z: 3 } as never,
      );
    });
    const byId = (id: string) => kit.history.current.elements.find((e) => e.id === id) as Record<string, unknown>;
    return { ...kit, byId };
  }

  it('takes in an element dropped inside it', () => {
    const { handler, selection, byId } = withFrame();
    selection.click('out');
    handler.down(at(420, 20));
    handler.move(at(120, 120));
    handler.up(at(120, 120));
    expect(byId('out').frame).toBe('f');
  });

  it('lets go of one dragged out', () => {
    const { handler, selection, byId } = withFrame();
    selection.click('in');
    handler.down(at(40, 40));
    handler.move(at(440, 440));
    handler.up(at(440, 440));
    expect(byId('in').frame).toBeUndefined();
  });

  it('carries its contents when the frame moves, in one step', () => {
    const { handler, selection, history, byId } = withFrame();
    selection.click('f');
    handler.down(at(100, 190));
    handler.move(at(150, 190));
    handler.up(at(150, 190));
    expect(byId('f').x).toBe(50);
    expect(byId('in').x).toBe(70);
    history.undo();
    expect(byId('in').x).toBe(20);
    expect(byId('f').x).toBe(0);
  });

  // The frame passes over the outside shape on its way; it must not adopt it.
  it('does not adopt what it passes over', () => {
    const { handler, selection, byId } = withFrame();
    selection.click('f');
    handler.down(at(100, 190));
    handler.move(at(400, 190));
    handler.up(at(400, 190));
    expect(byId('out').frame).toBeUndefined();
  });
});

// Carried from 06.2.1: a diagonal line's box is mostly empty space, and an
// axis-aligned one has none at all.
describe('selecting a line by its path', () => {
  function withLine(points: number[], box: Record<string, number>) {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push({ id: 'l', type: 'line', z: 1, points, ...box } as never);
    });
    return kit;
  }

  it('selects a diagonal line near the line, not in the corner of its box', () => {
    const { handler, selection } = withLine([0, 0, 100, 100], { x: 0, y: 0, w: 100, h: 100 });
    handler.down(at(50, 51));
    handler.up(at(50, 51));
    expect(selection.ids).toEqual(['l']);

    selection.clear();
    handler.down(at(5, 95));
    handler.up(at(5, 95));
    expect(selection.ids).toEqual([]);
  });

  it('selects a horizontal line, which has no height to click', () => {
    const { handler, selection } = withLine([0, 0, 100, 0], { x: 0, y: 40, w: 100, h: 0 });
    handler.down(at(50, 41));
    handler.up(at(50, 41));
    expect(selection.ids).toEqual(['l']);
  });
});

// Carried from 06.3: an arc bows away from the straight line between its
// ends, and the stored box has to hold what is drawn, or selection, the
// marquee, the eraser and the export bounds all cut the curve off.
describe('an arc arrow box', () => {
  // Since 06.15 (V2) a two-point arc is straight: the curve is a bent one.
  it('covers the curve it draws', () => {
    const kit = harness('arrow');
    kit.history.mutate((scene) => {
      scene.elements.push({ id: 'a', type: 'arrow', x: 0, y: 0, w: 100, h: 40, z: 1, points: [0, 0, 50, 40, 100, 0] } as never);
    });
    // Re-routing happens on every change; the box is settled with it.
    kit.history.mutate((scene) => {
      const arrow = scene.elements[0] as { arrowType: string };
      arrow.arrowType = 'arc';
    });
    const arrow = kit.history.current.elements[0];
    const drawn = pathBounds(drawnPathOf(arrow));
    expect(arrow.y + arrow.h).toBeGreaterThanOrEqual(drawn.y + drawn.h);
  });
});

// The endpoint drag writes bindings, so it needs the guards the draw path has.
describe('guards on the endpoint drag', () => {
  function bound() {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 } as never,
        { id: 'b', type: 'rect', x: 200, y: 0, w: 60, h: 60, z: 2 } as never,
        { id: 'arrow', type: 'arrow', x: 60, y: 30, w: 140, h: 0, z: 3, points: [0, 0, 140, 0], startBinding: 'a', endBinding: 'b' } as never,
      );
    });
    kit.selection.click('arrow');
    const arrow = () => kit.history.current.elements.find((e) => e.id === 'arrow') as Record<string, unknown>;
    return { ...kit, arrow };
  }

  // A bound end sits a gap clear of its shape, so a click on the handle finds
  // no shape under it: without a guard, clicking silently let the arrow go.
  it('a click on an end handle changes nothing', () => {
    const { handler, arrow, history } = bound();
    const before = JSON.stringify(arrow());
    const points = arrow().points as number[];
    const end = { x: (arrow().x as number) + points[2], y: (arrow().y as number) + points[3] };
    handler.down(end);
    handler.up(end);
    expect(JSON.stringify(arrow())).toBe(before);
    history.undo();
    // The only step in history is the one that built the scene.
    expect(history.current.elements).toHaveLength(0);
  });

  // Both ends on one shape leaves the arrow with nowhere to go: it collapsed
  // to a zero-size point at the shape's centre.
  it('refuses to bind both ends to the same shape', () => {
    const { handler, arrow } = bound();
    const points = arrow().points as number[];
    handler.down({ x: (arrow().x as number) + points[2], y: (arrow().y as number) + points[3] });
    handler.move(at(30, 30));
    handler.up(at(30, 30));
    expect(arrow().endBinding).toBeUndefined();
    expect(arrow().w).toBeGreaterThan(0);
  });
});

// A code block is placed with a click, like text: its size comes from its
// code, so there is nothing to drag out.
describe('placing a code block', () => {
  it('places an empty block where it was clicked, and reports it for editing', () => {
    const { history, handler } = harness('code');
    handler.down(at(40, 60));
    const placed = handler.up(at(40, 60));

    const block = history.current.elements[0] as Record<string, unknown>;
    expect(block).toMatchObject({ type: 'code', x: 40, y: 60, code: '' });
    expect(placed).toBe(block.id);
  });

  it('is one undo step', () => {
    const { history, handler } = harness('code');
    handler.down(at(40, 60));
    handler.up(at(40, 60));
    history.undo();
    expect(history.current.elements).toHaveLength(0);
  });

  it('places one block at the press, however far the pointer moved', () => {
    const { history, handler } = harness('code');
    handler.down(at(40, 60));
    handler.move(at(200, 200));
    handler.up(at(200, 200));
    // A drag with the code tool still places one block, at the press: there
    // is no size to drag out.
    expect(history.current.elements).toHaveLength(1);
    expect(history.current.elements[0]).toMatchObject({ x: 40, y: 60 });
  });
});

// A code block is resized like a shape: its width is the user's, its height
// follows its code (docs/file-format.md, "Code blocks").
describe('a code block resized by hand', () => {
  function placed() {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push({
        id: 'c',
        type: 'code',
        x: 0,
        y: 0,
        w: 100,
        h: 40,
        z: 1,
        code: 'x',
        measuredWidth: 100,
        measuredHeight: 40,
      } as never);
    });
    kit.selection.click('c');
    const block = () => kit.history.current.elements[0] as unknown as Record<string, number>;
    return { ...kit, block };
  }

  // Since 06.14 a corner resizes it like a shape, the height never below its
  // code (decision 10).
  it('resizes from a corner, never shorter than its code', () => {
    const { handler, block } = placed();
    handler.down(at(100, 40));
    handler.move(at(300, 300));
    handler.up(at(300, 300));
    expect(block().w).toBe(300);
    expect(block().h).toBe(300);
    expect(block().h).toBeGreaterThanOrEqual(block().measuredHeight);
  });

  it('still moves when it is dragged by its middle', () => {
    const { handler, block } = placed();
    handler.down(at(50, 20));
    handler.up(at(90, 20));
    expect(block().x).toBe(40);
  });
});

// A block placed and then left alone must not become an invisible 0x0 ghost
// in the user's file: it arrives at the size an empty block has.
describe('a freshly placed code block', () => {
  it('has the size of an empty block, not nothing', () => {
    const kit = harness('code');
    kit.handler.down(at(10, 10));
    kit.handler.up(at(10, 10));
    const block = kit.history.current.elements[0];
    expect(block.w).toBeGreaterThan(0);
    expect(block.h).toBeGreaterThan(0);
    expect(block).toMatchObject({ measuredWidth: block.w, measuredHeight: block.h });
  });
});

// As Excalidraw does: a shape tool lets go once it has made something, so the
// next press selects rather than drawing again. The pen is used stroke after
// stroke and the eraser pass after pass, so both stay on.
describe('the tool after a draw', () => {
  function draw(tool: Parameters<ReturnType<typeof createTools>['activate']>[0], to = at(60, 50)) {
    const h = harness(tool);
    h.handler.down(at(10, 10));
    h.handler.move(to);
    h.handler.up(to);
    return h;
  }

  it('selects a drawn rectangle and returns to select', () => {
    const { history, selection, tools } = draw('rect');
    expect(tools.active).toBe('select');
    expect(selection.ids).toEqual([history.current.elements[0].id]);
  });

  it('selects a drawn arrow and returns to select', () => {
    const { history, selection, tools } = draw('arrow');
    expect(tools.active).toBe('select');
    expect(selection.ids).toEqual([history.current.elements[0].id]);
  });

  it('selects a drawn frame and returns to select', () => {
    const { history, selection, tools } = draw('frame');
    expect(tools.active).toBe('select');
    expect(selection.ids).toEqual([history.current.elements[0].id]);
  });

  it('keeps the pen on after a stroke, and selects nothing', () => {
    const { history, selection, tools } = draw('pen');
    expect(history.current.elements).toHaveLength(1);
    expect(tools.active).toBe('pen');
    expect(selection.ids).toEqual([]);
  });

  it('keeps a shape tool when a click makes nothing', () => {
    const { history, selection, tools } = draw('rect', at(11, 11));
    expect(history.current.elements).toHaveLength(0);
    expect(tools.active).toBe('rect');
    expect(selection.ids).toEqual([]);
  });
});

// The threshold is on screen: the caller divides it by the zoom, so a twitch is
// a click at any zoom and a drag needs the same hand movement at any zoom.
describe('the drag threshold', () => {
  function drag(threshold: number, by: number) {
    const history = createHistory({ elements: [] });
    const tools = createTools();
    tools.activate('rect');
    const handler = createPointerHandler({ history, selection: createSelection(), tools, dragThreshold: () => threshold });
    handler.down(at(10, 10));
    handler.move(at(10 + by, 10 + by));
    handler.up(at(10 + by, 10 + by));
    return history.current.elements.length;
  }

  it('treats a 5 unit move as a click when zoomed in (threshold 12)', () => {
    expect(drag(12, 5)).toBe(0);
  });

  it('draws from a 1 unit move when zoomed out (threshold 0.75)', () => {
    expect(drag(0.75, 1)).toBe(1);
  });
});

// Decided on release, as Excalidraw does: a press on a selected element may be
// the start of a drag of the whole selection, so only a click changes it.
describe('clicking inside a selection', () => {
  function threeSelected() {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 },
        { id: 'b', type: 'rect', x: 50, y: 0, w: 20, h: 20, z: 2 },
        { id: 'c', type: 'rect', x: 100, y: 0, w: 20, h: 20, z: 3 },
      ] as never,
    });
    const selection = createSelection();
    ['a', 'b', 'c'].forEach((id, i) => selection.click(id, { additive: i > 0 }));
    const tools = createTools();
    const handler = createPointerHandler({ history, selection, tools });
    return { history, selection, handler };
  }

  it('removes a selected element on shift-click', () => {
    const { selection, handler } = threeSelected();
    handler.down(at(60, 10), { additive: true, shift: true });
    handler.up(at(60, 10), { shift: true });
    expect(selection.ids).toEqual(['a', 'c']);
  });

  it('moves the selection and keeps it on shift-drag from a selected element', () => {
    const { history, selection, handler } = threeSelected();
    handler.down(at(60, 10), { additive: true, shift: true });
    handler.move(at(60, 40), { shift: true });
    handler.up(at(60, 40), { shift: true });
    expect(selection.ids).toEqual(['a', 'b', 'c']);
    expect(history.current.elements.map((e) => e.y)).toEqual([30, 30, 30]);
  });

  it('narrows to the element clicked when several are selected', () => {
    const { selection, handler } = threeSelected();
    handler.down(at(60, 10));
    handler.up(at(60, 10));
    expect(selection.ids).toEqual(['b']);
  });

  it('moves them all on a drag from one of several selected', () => {
    const { history, selection, handler } = threeSelected();
    handler.down(at(60, 10));
    handler.move(at(80, 10));
    handler.up(at(80, 10));
    expect(selection.ids).toEqual(['a', 'b', 'c']);
    expect(history.current.elements.map((e) => e.x)).toEqual([20, 70, 120]);
  });
});

// Empty space between selected shapes is still part of the selection: a press
// there drags it, rather than dropping it to start a marquee.
describe('pressing inside a selection of several', () => {
  function twoSelected() {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 },
        { id: 'b', type: 'rect', x: 100, y: 0, w: 20, h: 20, z: 2 },
      ] as never,
    });
    const selection = createSelection();
    selection.click('a');
    selection.click('b', { additive: true });
    const handler = createPointerHandler({ history, selection, tools: createTools() });
    return { history, selection, handler };
  }

  it('drags the selection from empty space inside its box', () => {
    const { history, selection, handler } = twoSelected();
    handler.down(at(60, 10));
    handler.move(at(60, 40));
    handler.up(at(60, 40));
    expect(selection.ids).toEqual(['a', 'b']);
    expect(history.current.elements.map((e) => e.y)).toEqual([30, 30]);
  });

  it('still starts a marquee from outside the box', () => {
    const { history, selection, handler } = twoSelected();
    handler.down(at(60, 100));
    handler.move(at(200, 200));
    handler.up(at(200, 200));
    expect(selection.ids).toEqual([]);
    expect(history.current.elements.map((e) => e.y)).toEqual([0, 0]);
  });

  it('clears the selection on a click in empty space inside its box', () => {
    const { selection, handler } = twoSelected();
    handler.down(at(60, 10));
    handler.up(at(60, 10));
    expect(selection.ids).toEqual([]);
  });
});

// Shift constrains a move to the axis it mostly travels along, read on every
// move, so pressing or releasing it mid-drag changes the preview at once.
describe('a shift-drag', () => {
  function one() {
    const history = createHistory({ elements: [{ id: 'a', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 }] as never });
    const handler = createPointerHandler({ history, selection: createSelection(), tools: createTools() });
    return { history, handler };
  }

  it('moves along the dominant axis only', () => {
    const { history, handler } = one();
    handler.down(at(10, 10));
    handler.move(at(50, 18), { shift: true });
    handler.up(at(50, 18), { shift: true });
    expect(history.current.elements[0]).toMatchObject({ x: 40, y: 0 });
  });

  it('follows Shift as it is pressed and released mid-drag', () => {
    const { history, handler } = one();
    handler.down(at(10, 10));
    expect(handler.preview(at(18, 50), { shift: true })!.elements[0]).toMatchObject({ x: 0, y: 40 });
    handler.move(at(18, 50));
    handler.up(at(18, 50));
    expect(history.current.elements[0]).toMatchObject({ x: 8, y: 40 });
  });
});

// Alt while moving copies instead, as in Excalidraw: the originals stay, the
// copies move and become the selection. Read on every move, like Shift.
describe('an alt-drag', () => {
  function withGroup() {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 },
        { id: 'b', type: 'rect', x: 40, y: 0, w: 20, h: 20, z: 2 },
        { id: 'g', type: 'group', x: 0, y: 0, w: 60, h: 20, z: 3, children: ['a', 'b'] },
        { id: 's', type: 'rect', x: 200, y: 0, w: 20, h: 20, z: 4 },
      ] as never,
    });
    const selection = createSelection();
    const handler = createPointerHandler({ history, selection, tools: createTools() });
    return { history, selection, handler };
  }

  it('leaves the original and moves a copy', () => {
    const { history, handler } = withGroup();
    handler.down(at(210, 10));
    handler.move(at(210, 60), { alt: true });
    handler.up(at(210, 60), { alt: true });
    const rects = history.current.elements.filter((e) => e.type === 'rect' && e.x === 200);
    expect(rects.map((e) => e.y).sort()).toEqual([0, 50]);
    expect(history.current.elements.find((e) => e.id === 's')).toMatchObject({ y: 0 });
  });

  // A copy exactly on its original is invisible and would sit in the file.
  it('copies nothing on an alt-click that does not move', () => {
    const { history, handler } = withGroup();
    handler.down(at(210, 10));
    handler.up(at(211, 10), { alt: true });
    expect(history.current.elements).toHaveLength(4);
  });

  it('selects the copy after release', () => {
    const { history, selection, handler } = withGroup();
    handler.down(at(210, 10));
    handler.up(at(210, 60), { alt: true });
    const copy = history.current.elements.find((e) => e.type === 'rect' && e.y === 50)!;
    expect(copy.id).not.toBe('s');
    expect(selection.ids).toEqual([copy.id]);
  });

  it('keeps one copy id for the whole drag', () => {
    const { handler } = withGroup();
    handler.down(at(210, 10));
    handler.move(at(210, 30), { alt: true });
    const first = handler.preview(at(210, 30));
    handler.move(at(210, 40), { alt: true });
    const second = handler.preview(at(210, 40));
    const ids = (scene: typeof first) => scene!.elements.map((e) => e.id).sort();
    expect(first!.elements).toHaveLength(5);
    expect(ids(first)).toEqual(ids(second));
  });

  it('moves the original instead when Alt is released mid-drag', () => {
    const { history, handler } = withGroup();
    handler.down(at(210, 10));
    handler.move(at(210, 40), { alt: true });
    handler.move(at(210, 60));
    handler.up(at(210, 60));
    expect(history.current.elements).toHaveLength(4);
    expect(history.current.elements.find((e) => e.id === 's')).toMatchObject({ y: 50 });
  });

  it('is one undo step, however much it copied', () => {
    const { history, handler } = withGroup();
    handler.down(at(10, 10));
    handler.up(at(10, 60), { alt: true });
    history.undo();
    expect(history.current.elements.map((e) => e.id)).toEqual(['a', 'b', 'g', 's']);
  });

  it('names copies without stacking prefixes when a copy is copied', () => {
    const { history, handler, selection } = withGroup();
    handler.down(at(210, 10));
    handler.up(at(210, 60), { alt: true });
    handler.down(at(210, 60));
    handler.up(at(210, 110), { alt: true });
    const [latest] = selection.ids;
    expect(latest.length).toBeLessThan(20);
    expect(history.current.elements.filter((e) => e.type === 'rect')).toHaveLength(5);
  });

  it('copies a frame with its contents into the copied frame', () => {
    const history = createHistory({
      elements: [
        { id: 'f', type: 'frame', x: 0, y: 0, w: 100, h: 100, z: 1 },
        { id: 'in', type: 'rect', x: 10, y: 10, w: 20, h: 20, z: 2, frame: 'f' },
      ] as never,
    });
    const selection = createSelection();
    selection.click('f');
    const handler = createPointerHandler({ history, selection, tools: createTools() });
    handler.down(at(95, 50));
    handler.up(at(115, 50), { alt: true });
    const copy = history.current.elements.find((e) => e.type === 'frame' && e.id !== 'f')!;
    expect(history.current.elements.filter((e) => (e as { frame?: string }).frame === copy.id)).toHaveLength(1);
    expect(history.current.elements.find((e) => e.id === 'in')).toMatchObject({ frame: 'f', x: 10 });
  });

  it('copies a group with its children, pointing at the copies', () => {
    const { history, handler } = withGroup();
    handler.down(at(10, 10));
    handler.up(at(10, 60), { alt: true });
    const groups = history.current.elements.filter((e) => e.type === 'group') as unknown as { id: string; children: string[] }[];
    expect(groups).toHaveLength(2);
    const copy = groups.find((g) => g.id !== 'g')!;
    const children = history.current.elements.filter((e) => copy.children.includes(e.id));
    expect(children.map((e) => e.y)).toEqual([50, 50]);
    expect(history.current.elements.filter((e) => e.type === 'rect' && e.y === 0)).toHaveLength(3);
  });
});

// Resizing a frame changes the frame; what is inside keeps its size and place.
// Moving a frame still carries its contents.
describe('resizing a frame', () => {
  it('leaves its contents alone', () => {
    const history = createHistory({
      elements: [
        { id: 'f', type: 'frame', x: 0, y: 0, w: 100, h: 100, z: 1 },
        { id: 'in', type: 'rect', x: 10, y: 10, w: 20, h: 20, z: 2, frame: 'f' },
      ] as never,
    });
    const selection = createSelection();
    selection.click('f');
    const handler = createPointerHandler({ history, selection, tools: createTools(), handleSize: () => 4 });
    // The bottom-right handle, dragged out to double the frame.
    handler.down(at(100, 100));
    handler.move(at(200, 200));
    handler.up(at(200, 200));
    expect(history.current.elements.find((e) => e.id === 'f')).toMatchObject({ w: 200, h: 200 });
    expect(history.current.elements.find((e) => e.id === 'in')).toMatchObject({ x: 10, y: 10, w: 20, h: 20, frame: 'f' });
  });
});

describe('shrinking a frame past what it holds', () => {
  // Its contents keep their place, so what the frame no longer surrounds must
  // stop recording it; otherwise the next drag of the frame carries it off.
  it('lets go of a member it no longer holds', () => {
    const history = createHistory({
      elements: [
        { id: 'f', type: 'frame', x: 0, y: 0, w: 100, h: 100, z: 1 },
        { id: 'in', type: 'rect', x: 70, y: 70, w: 20, h: 20, z: 2, frame: 'f' },
      ] as never,
    });
    const selection = createSelection();
    selection.click('f');
    const handler = createPointerHandler({ history, selection, tools: createTools(), handleSize: () => 4 });
    handler.down(at(100, 100));
    handler.move(at(50, 50));
    handler.up(at(50, 50));
    expect(history.current.elements.find((e) => e.id === 'in')).not.toHaveProperty('frame');
  });
});

// Alt pressed or released with the pointer still: the preview must show what
// the release will commit.
describe('Alt changed without moving', () => {
  it('previews the copy when Alt is pressed after the last move', () => {
    const history = createHistory({ elements: [{ id: 's', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 }] as never });
    const handler = createPointerHandler({ history, selection: createSelection(), tools: createTools() });
    handler.down(at(10, 10));
    handler.move(at(10, 60));
    expect(handler.preview(at(10, 60), { alt: true })!.elements).toHaveLength(2);
    expect(handler.preview(at(10, 60), { alt: false })!.elements).toHaveLength(1);
  });
});

// Movement under the drag threshold is a click, from any press: the preview
// shows nothing moving, and the release commits nothing.
describe('a twitch on an element', () => {
  it('moves nothing, in preview or on release', () => {
    const history = createHistory({ elements: [{ id: 's', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 }] as never });
    const handler = createPointerHandler({ history, selection: createSelection(), tools: createTools() });
    handler.down(at(10, 10));
    handler.move(at(11, 11));
    expect(handler.preview(at(11, 11))).toBeNull();
    handler.up(at(11, 11));
    expect(history.current.elements[0]).toMatchObject({ x: 0, y: 0 });
  });
});

// Decision 4: a dropped end remembers where on the shape it landed, snapping
// to a side's middle when dropped just outside it.
describe('where a dropped end attaches', () => {
  function withArrow(bindings: Record<string, unknown> = {}) {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 } as never,
        { id: 'b', type: 'rect', x: 200, y: 0, w: 100, h: 100, z: 2 } as never,
        { id: 'arrow', type: 'arrow', x: 100, y: 30, w: 60, h: 0, z: 3, points: [0, 0, 60, 0], ...bindings } as never,
      );
    });
    kit.selection.click('arrow');
    const arrow = () => kit.history.current.elements.find((e) => e.id === 'arrow') as Record<string, unknown>;
    return { ...kit, arrow };
  }

  it('records the spot on the shape it was dropped on', () => {
    const { handler, arrow } = withArrow();
    handler.down(at(160, 30));
    handler.move(at(225, 80));
    handler.up(at(225, 80));
    expect(arrow()).toMatchObject({ endBinding: 'b', endAnchor: [0.25, 0.8] });
  });

  it('snaps to a side middle when dropped just outside it', () => {
    const { handler, arrow } = withArrow();
    handler.down(at(160, 30));
    handler.move(at(195, 52));
    handler.up(at(195, 52));
    expect(arrow()).toMatchObject({ endBinding: 'b', endAnchor: [0, 0.5] });
  });

  it('does not snap when dropped inside', () => {
    const { handler, arrow } = withArrow();
    handler.down(at(160, 30));
    handler.move(at(203, 52));
    handler.up(at(203, 52));
    expect(arrow().endAnchor).toEqual([0.03, 0.52]);
  });

  it('removes the spot with the binding when it lets go', () => {
    const { handler, arrow } = withArrow({ endBinding: 'b', endAnchor: [0, 0.5] });
    // The end sits on b's left side, level with its middle, a gap clear.
    handler.down(at(196, 50));
    handler.move(at(150, 300));
    handler.up(at(150, 300));
    expect(arrow()).not.toHaveProperty('endBinding');
    expect(arrow()).not.toHaveProperty('endAnchor');
  });

  it('records spots when an arrow is drawn between shapes', () => {
    const kit = harness('arrow');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never,
        { id: 'b', type: 'rect', x: 200, y: 0, w: 100, h: 100, z: 2 } as never,
      );
    });
    kit.handler.down(at(50, 50));
    kit.handler.move(at(250, 20));
    kit.handler.up(at(250, 20));
    const drawn = kit.history.current.elements.find((e) => e.type === 'arrow') as Record<string, unknown>;
    expect(drawn).toMatchObject({ startAnchor: [0.5, 0.5], endAnchor: [0.5, 0.2] });
  });

  it('highlights the shape an existing end would attach to while it is dragged', () => {
    const { handler } = withArrow();
    handler.down(at(160, 30));
    handler.move(at(225, 80));
    expect(handler.bindingCandidates).toEqual(['b']);
  });

  // 06.14 E5: an elbow end snaps to a side's middle within a band 5% of the
  // side, from inside the shape as well, and is never pinned.
  it('snaps an elbow end to a middle from inside the shape', () => {
    const { handler, arrow } = withArrow({ arrowType: 'elbow' });
    handler.down(at(160, 30));
    handler.move(at(253, 20));
    handler.up(at(253, 20));
    expect(arrow()).toMatchObject({ endBinding: 'b', endAnchor: [0.5, 0] });
    expect(arrow()).not.toHaveProperty('endMode');
  });

  it("shows the target's middles while an elbow end is dragged, and only then", () => {
    const elbow = withArrow({ arrowType: 'elbow' });
    elbow.handler.down(at(160, 30));
    elbow.handler.move(at(225, 80));
    expect(elbow.handler.snapSpots).toEqual([
      { x: 250, y: 0 },
      { x: 300, y: 50 },
      { x: 250, y: 100 },
      { x: 200, y: 50 },
    ]);
    const straight = withArrow();
    straight.handler.down(at(160, 30));
    straight.handler.move(at(225, 80));
    expect(straight.handler.snapSpots).toEqual([]);
  });
});

// Decisions 1 and 2: a selected line or arrow is bent by dragging the middle
// of a segment, a bend is moved by dragging it and removed by double-clicking
// it. An elbow routes itself and offers no bends.
describe('bending a line or arrow', () => {
  function selected(element: Record<string, unknown>) {
    const history = createHistory({ elements: [{ id: 'l', z: 1, ...element }] as never });
    const selection = createSelection();
    selection.click('l');
    const handler = createPointerHandler({ history, selection, tools: createTools(), handleSize: () => 4, bendMinSegment: () => 40 });
    const points = () => (history.current.elements[0] as unknown as { x: number; y: number; points: number[] });
    const world = () => {
      const e = points();
      return e.points.map((v, i) => v + (i % 2 === 0 ? e.x : e.y));
    };
    return { history, handler, world };
  }
  const straight = { type: 'arrow', x: 0, y: 0, w: 200, h: 0, points: [0, 0, 200, 0] };

  it('adds a bend where a segment middle is dragged to', () => {
    const { handler, world } = selected(straight);
    handler.down(at(100, 0));
    handler.move(at(100, 80));
    handler.up(at(100, 80));
    expect(world()).toEqual([0, 0, 100, 80, 200, 0]);
  });

  it('moves a bend that is dragged', () => {
    const { handler, world } = selected({ ...straight, h: 80, points: [0, 0, 100, 80, 200, 0] });
    handler.down(at(100, 80));
    handler.move(at(120, 60));
    handler.up(at(120, 60));
    expect(world()).toEqual([0, 0, 120, 60, 200, 0]);
  });

  // 06.15 P24, the user's answer: as Excalidraw, a double-click on a bend
  // removes nothing (06.10 had it remove the bend).
  it('removes nothing on a double-click on a bend', () => {
    const { handler, world } = selected({ ...straight, type: 'line', h: 80, points: [0, 0, 100, 80, 200, 0] });
    handler.doubleClick(at(101, 79));
    expect(world()).toEqual([0, 0, 100, 80, 200, 0]);
    expect('removeBendAt' in handler).toBe(false);
  });

  it('moves the end of a line that is dragged', () => {
    const { handler, world } = selected({ type: 'line', x: 0, y: 0, w: 100, h: 0, points: [0, 0, 100, 0] });
    handler.down(at(100, 0));
    handler.move(at(100, 50));
    handler.up(at(100, 50));
    expect(world()).toEqual([0, 0, 100, 50]);
  });

  // An elbow's points are its route (06.12): a press on it moves the whole
  // arrow, never adds a bend. Since 06.14 a segment's middle is a handle of
  // its own (E7), so the press lands on the path away from any middle.
  it('offers no bend on an elbow arrow', () => {
    const { handler, history } = selected({ ...straight, h: 100, arrowType: 'elbow', points: [0, 0, 200, 100] });
    history.reset(history.current);
    const before = (history.current.elements[0] as unknown as { points: number[] }).points;
    const y = (history.current.elements[0] as unknown as { y: number }).y;
    expect(before.slice(0, 4)).toEqual([0, 0, 200, 0]);
    handler.down(at(40, 0));
    handler.move(at(40, 40));
    handler.up(at(40, 40));
    const after = history.current.elements[0] as unknown as { y: number; points: number[] };
    // Moved as a whole by the drag, with its route unchanged.
    expect(after.y).toBe(y + 40);
    expect(after.points).toEqual(before);
  });

  it('offers no middle on a segment too short to bend', () => {
    const { handler, history } = selected({ type: 'arrow', x: 0, y: 0, w: 30, h: 0, points: [0, 0, 30, 0] });
    handler.down(at(15, 0));
    handler.move(at(15, 40));
    handler.up(at(15, 40));
    expect((history.current.elements[0] as unknown as { points: number[] }).points).toHaveLength(4);
  });
});

// Decision 5: an attached arrow dragged by its body lets go of every shape not
// moving with it, as Excalidraw does; before, the drag was silently undone.
describe('dragging an attached arrow by its body', () => {
  function attached() {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 },
        { id: 'b', type: 'rect', x: 300, y: 0, w: 60, h: 60, z: 2 },
        {
          id: 'arrow', type: 'arrow', x: 64, y: 30, w: 232, h: 0, z: 3, points: [0, 0, 232, 0],
          startBinding: 'a', endBinding: 'b', startAnchor: [0.5, 0.5], endAnchor: [0.5, 0.5],
        },
      ] as never,
    });
    const selection = createSelection();
    const handler = createPointerHandler({ history, selection, tools: createTools() });
    const arrow = () => history.current.elements.find((e) => e.id === 'arrow') as unknown as Record<string, unknown>;
    return { history, selection, handler, arrow };
  }

  it('moves it and lets both ends go when dragged alone', () => {
    const { handler, arrow } = attached();
    handler.down(at(180, 30));
    handler.move(at(180, 130));
    handler.up(at(180, 130));
    expect(arrow()).toMatchObject({ y: 130 });
    for (const key of ['startBinding', 'endBinding', 'startAnchor', 'endAnchor']) expect(arrow()).not.toHaveProperty(key);
  });

  it('keeps it attached when dragged with both its shapes', () => {
    const { handler, selection, arrow } = attached();
    ['a', 'b', 'arrow'].forEach((id, i) => selection.click(id, { additive: i > 0 }));
    handler.down(at(180, 30));
    handler.move(at(180, 130));
    handler.up(at(180, 130));
    expect(arrow()).toMatchObject({ startBinding: 'a', endBinding: 'b', y: 130 });
  });

  // A binding whose target is gone is kept, never removed without the user
  // choosing to (docs/file-format.md): the move lets go of shapes, not ids.
  it('keeps a detached end detached rather than dropping its binding', () => {
    const { history, handler, arrow } = attached();
    history.mutate((scene) => {
      scene.elements = scene.elements.filter((e) => e.id !== 'b');
    });
    handler.down(at(180, 30));
    handler.move(at(180, 130));
    handler.up(at(180, 130));
    expect(arrow()).toMatchObject({ endBinding: 'b' });
    expect(arrow()).not.toHaveProperty('startBinding');
  });

  it('lets go only of the end whose shape stays', () => {
    const { handler, selection, arrow } = attached();
    ['a', 'arrow'].forEach((id, i) => selection.click(id, { additive: i > 0 }));
    handler.down(at(180, 30));
    handler.move(at(180, 130));
    handler.up(at(180, 130));
    expect(arrow()).toMatchObject({ startBinding: 'a' });
    expect(arrow()).not.toHaveProperty('endBinding');
  });
});

// Decision 6: a selected arrow's label is dragged along it; where it ends up
// is stored as a share of the path.
describe('sliding a label along its arrow', () => {
  it('stores where along the arrow it was dragged to', () => {
    const history = createHistory({
      elements: [{ id: 'arrow', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0], label: 'sends' }] as never,
    });
    const selection = createSelection();
    selection.click('arrow');
    const handler = createPointerHandler({
      history,
      selection,
      tools: createTools(),
      handleSize: () => 4,
      // The label's box as the stage draws it, centred on the middle.
      labelBounds: () => ({ x: 70, y: -10, w: 60, h: 20 }),
    });
    handler.down(at(80, 5));
    handler.move(at(150, 5));
    handler.up(at(150, 5));
    expect(history.current.elements[0]).toMatchObject({ labelPosition: 0.85, x: 0, y: 0 });
  });
});

// Review of 06.10: a line or free arrow can be turned. Its handles are where
// it is drawn, and bending it writes the turn into its points, so what is
// drawn does not jump.
describe('bending a turned line', () => {
  function turned() {
    // Drawn upright: from (50, -50) to (50, 50), a quarter turn about (50, 0).
    const history = createHistory({
      elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 100, h: 0, z: 1, angle: 90, points: [0, 0, 100, 0] }] as never,
    });
    const selection = createSelection();
    selection.click('l');
    const handler = createPointerHandler({ history, selection, tools: createTools(), handleSize: () => 4, bendMinSegment: () => 40 });
    const drawn = () => {
      const e = history.current.elements[0] as unknown as { x: number; y: number; points: number[]; angle?: number };
      return { angle: e.angle ?? 0, points: e.points.map((v, i) => Math.round(v + (i % 2 === 0 ? e.x : e.y))) };
    };
    return { handler, drawn };
  }

  it('bends where its middle is drawn, and keeps its ends where they were drawn', () => {
    const { handler, drawn } = turned();
    handler.down(at(50, 0));
    handler.move(at(80, 0));
    handler.up(at(80, 0));
    expect(drawn()).toEqual({ angle: 0, points: [50, -50, 80, 0, 50, 50] });
  });

  it('moves an end from where it is drawn', () => {
    const { handler, drawn } = turned();
    handler.down(at(50, 50));
    handler.move(at(50, 90));
    handler.up(at(50, 90));
    expect(drawn()).toEqual({ angle: 0, points: [50, -50, 50, 90] });
  });
});

describe('review of 06.10: labels, copies and modifiers on arrows', () => {
  it('slides the label of a turned arrow along the arrow as drawn', () => {
    // Drawn upright from (100, -100) to (100, 100); the label starts at (100, 0).
    const history = createHistory({
      elements: [{ id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, angle: 90, points: [0, 0, 200, 0], label: 'x' }] as never,
    });
    const selection = createSelection();
    selection.click('a');
    const handler = createPointerHandler({
      history, selection, tools: createTools(), handleSize: () => 4, labelBounds: () => ({ x: 90, y: -20, w: 20, h: 40 }),
    });
    // On the label, clear of the middle handle, which beats it since 06.14.
    handler.down(at(100, 15));
    handler.move(at(100, 65));
    handler.up(at(100, 65));
    expect(history.current.elements[0]).toMatchObject({ labelPosition: 0.75 });
  });

  it('lets an alt-dragged copy of an attached arrow go of shapes not copied', () => {
    const history = createHistory({
      elements: [
        { id: 's', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 },
        { id: 'arrow', type: 'arrow', x: 64, y: 30, w: 200, h: 0, z: 2, points: [0, 0, 200, 0], startBinding: 's', startAnchor: [0.5, 0.5] },
      ] as never,
    });
    const selection = createSelection();
    const handler = createPointerHandler({ history, selection, tools: createTools() });
    handler.down(at(160, 30));
    handler.up(at(160, 130), { alt: true });
    const copy = history.current.elements.find((e) => e.type === 'arrow' && e.id !== 'arrow') as unknown as Record<string, unknown>;
    expect(copy).toMatchObject({ y: 130 });
    expect(copy).not.toHaveProperty('startBinding');
    expect(copy).not.toHaveProperty('startAnchor');
    expect(history.current.elements.find((e) => e.id === 'arrow')).toMatchObject({ startBinding: 's' });
  });

  it('shift-clicks a selected arrow off the selection even on its handles', () => {
    // Bent, so the first segment's middle (50, 40) is not also a box handle.
    const history = createHistory({ elements: [{ id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 80, z: 1, points: [0, 0, 100, 80, 200, 0] }] as never });
    const selection = createSelection();
    selection.click('a');
    const handler = createPointerHandler({ history, selection, tools: createTools(), handleSize: () => 4, bendMinSegment: () => 40 });
    handler.down(at(50, 40), { additive: true, shift: true });
    handler.up(at(50, 40), { shift: true });
    expect(selection.ids).toEqual([]);
  });

  // 06.14 S8, reversing 06.13: the middle handle keeps precedence over the
  // label it sits under (Excalidraw's `linearElementEditor.ts:1154-1168`), so
  // a labelled arrow can still be bent; the rest of the label slides it.
  it('gives the middle handle priority over the label that covers it', () => {
    const make = () => {
      const history = createHistory({
        elements: [{ id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0], label: 'x' }] as never,
      });
      const selection = createSelection();
      selection.click('a');
      const handler = createPointerHandler({
        history, selection, tools: createTools(), handleSize: () => 4, bendMinSegment: () => 40, labelBounds: () => ({ x: 70, y: -10, w: 60, h: 20 }),
      });
      return { history, handler };
    };
    const onMiddle = make();
    onMiddle.handler.down(at(100, 0));
    onMiddle.handler.move(at(100, 50));
    onMiddle.handler.up(at(100, 50));
    expect((onMiddle.history.current.elements[0] as unknown as { points: number[] }).points).toHaveLength(6);

    const onLabel = make();
    onLabel.handler.down(at(75, 0));
    onLabel.handler.move(at(125, 0));
    onLabel.handler.up(at(125, 0));
    const arrow = onLabel.history.current.elements[0] as unknown as { points: number[]; labelPosition?: number };
    expect(arrow.points).toHaveLength(4);
    expect(arrow.labelPosition).toBe(0.75);
  });

  it('bends an arc from the middle of its curve, not of its chord', () => {
    const history = createHistory({ elements: [{ id: 'a', type: 'arrow', arrowType: 'arc', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0] }] as never });
    const selection = createSelection();
    selection.click('a');
    const handler = createPointerHandler({ history, selection, tools: createTools(), handleSize: () => 4, bendMinSegment: () => 40 });
    // The arc bows 0.2 of its length to the left of travel: up to y = 20 at its middle.
    const middle = labelPoint(routePoints([0, 0, 200, 0], 'arc'));
    handler.down(at(middle.x, middle.y));
    handler.move(at(middle.x, middle.y + 40));
    handler.up(at(middle.x, middle.y + 40));
    expect((history.current.elements[0] as unknown as { points: number[] }).points).toHaveLength(6);
  });
});

// Decision 1 of 06.12: a code block is resized like a shape; its width is the
// user's and its height follows its wrapped code.
describe('resizing a code block', () => {
  const metrics = { advance: 6, lineHeight: 20, padding: 8 };
  function selectedBlock() {
    // Sixteen letters at advance 6: 96 wide plus padding, one line tall.
    const history = createHistory({
      elements: [{ id: 'c', type: 'code', x: 0, y: 0, w: 112, h: 36, z: 1, code: 'abcdefghijklmnop', measuredWidth: 112, measuredHeight: 36 }] as never,
    });
    const selection = createSelection();
    selection.click('c');
    const handler = createPointerHandler({ history, selection, tools: createTools(), handleSize: () => 4, codeMetrics: () => metrics });
    const block = () => history.current.elements[0] as unknown as { w: number; h: number; measuredWidth: number; measuredHeight: number };
    return { handler, block };
  }

  it('narrows, and grows taller as its line wraps', () => {
    const { handler, block } = selectedBlock();
    handler.down(at(112, 18));
    handler.move(at(76, 18));
    handler.up(at(76, 18));
    expect(block()).toMatchObject({ w: 76, h: 56, measuredWidth: 76, measuredHeight: 56 });
  });

  it('widens without changing its height', () => {
    const { handler, block } = selectedBlock();
    handler.down(at(112, 18));
    handler.move(at(200, 18));
    handler.up(at(200, 18));
    expect(block()).toMatchObject({ w: 200, h: 36 });
  });
});

describe('pressing on a selected line or arrow, as Excalidraw', () => {
  function selected(element: Record<string, unknown>) {
    const history = createHistory({ elements: [{ id: 'l', z: 1, ...element }] as never });
    const selection = createSelection();
    selection.click('l');
    const handler = createPointerHandler({ history, selection, tools: createTools(), handleSize: () => 4, pointHit: () => 11, bendMinSegment: () => 40 });
    const points = () => (history.current.elements[0] as unknown as { points: number[]; w: number; h: number });
    return { handler, points };
  }

  it('takes a point within 11 px of it', () => {
    const { handler, points } = selected({ type: 'arrow', x: 0, y: 0, w: 200, h: 0, points: [0, 0, 200, 0] });
    // 9.9 px from the end: outside the old 4 px square, inside 11 px.
    handler.down(at(207, 7));
    handler.move(at(207, 57));
    handler.up(at(207, 57));
    expect(points().points.at(-1)).toBeGreaterThan(40);
  });

  it('does not resize a straight arrow from where its box corner would be', () => {
    const { handler, points } = selected({ type: 'arrow', x: 0, y: 0, w: 200, h: 100, points: [0, 0, 200, 100] });
    handler.down(at(200, 0));
    handler.move(at(300, -50));
    handler.up(at(300, -50));
    expect(points()).toMatchObject({ w: 200, h: 100, points: [0, 0, 200, 100] });
  });
});

// Excalidraw's drag details (linearElementEditor.ts:542-557,1233-1240,
// 1736-1779; App.tsx:11745-11815): a point keeps its grab offset, Shift snaps
// it to 15° about its neighbour, a middle adds a bend only after 10 px, and a
// new line or arrow needs a 20 px drag.
describe('dragging points like Excalidraw', () => {
  function selected(element: Record<string, unknown>) {
    const history = createHistory({ elements: [{ id: 'l', z: 1, ...element }] as never });
    const selection = createSelection();
    selection.click('l');
    const handler = createPointerHandler({
      history, selection, tools: createTools(), handleSize: () => 4, pointHit: () => 11, bendMinSegment: () => 40, bendInsertDistance: () => 10,
    });
    const world = () => {
      const e = history.current.elements[0] as unknown as { x: number; y: number; points: number[] };
      return e.points.map((v, i) => Math.round(v + (i % 2 === 0 ? e.x : e.y)));
    };
    return { handler, world };
  }
  const straight = { type: 'line', x: 0, y: 0, w: 200, h: 0, points: [0, 0, 200, 0] };

  it('keeps the offset from where the point was grabbed', () => {
    const { handler, world } = selected(straight);
    handler.down(at(205, 5));
    handler.move(at(205, 55));
    handler.up(at(205, 55));
    expect(world()).toEqual([0, 0, 200, 50]);
  });

  it('snaps a dragged end to 15 degree steps about its neighbour with Shift', () => {
    const { handler, world } = selected(straight);
    handler.down(at(200, 0));
    handler.move(at(190, 60), { shift: true });
    handler.up(at(190, 60), { shift: true });
    const [, , x, y] = world();
    const degrees = (Math.atan2(y, x) * 180) / Math.PI;
    expect(Math.abs(degrees - Math.round(degrees / 15) * 15)).toBeLessThan(0.5);
  });

  it('adds no bend for a middle moved 5 px', () => {
    const { handler, world } = selected(straight);
    handler.down(at(100, 0));
    handler.move(at(100, 5));
    handler.up(at(100, 5));
    expect(world()).toEqual([0, 0, 200, 0]);
  });

  it('makes no arrow from a drag shorter than 20 px', () => {
    const history = createHistory({ elements: [] });
    const tools = createTools();
    tools.activate('arrow');
    const handler = createPointerHandler({ history, selection: createSelection(), tools, minLinear: () => 20 });
    handler.down(at(0, 0));
    handler.move(at(12, 8));
    handler.up(at(12, 8));
    expect(history.current.elements).toHaveLength(0);
  });
});

describe('dragging an arrow end like Excalidraw', () => {
  it('keeps the grab offset and snaps with Shift', () => {
    const history = createHistory({ elements: [{ id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0] }] as never });
    const selection = createSelection();
    selection.click('a');
    const handler = createPointerHandler({ history, selection, tools: createTools(), pointHit: () => 11 });
    handler.down(at(205, 5));
    handler.move(at(205, 55));
    handler.up(at(205, 55));
    const arrow = history.current.elements[0] as unknown as { x: number; y: number; points: number[] };
    expect([arrow.x + arrow.points[2], arrow.y + arrow.points[3]]).toEqual([200, 50]);
  });
});

// Decision 7 (06.13): inside a shape pins the end, just outside attaches it to
// the edge, Alt pins, Cmd/Ctrl leaves it free (Excalidraw binding.ts:830-860).
describe('where a dropped end attaches, inside or at the edge', () => {
  function withShape() {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'b', type: 'rect', x: 200, y: 0, w: 100, h: 100, z: 1 } as never,
        { id: 'arrow', type: 'arrow', x: 0, y: 50, w: 100, h: 0, z: 2, points: [0, 0, 100, 0] } as never,
      );
    });
    kit.selection.click('arrow');
    const arrow = () => kit.history.current.elements.find((e) => e.id === 'arrow') as Record<string, unknown>;
    return { ...kit, arrow };
  }

  it('pins an end dropped inside the shape', () => {
    const { handler, arrow } = withShape();
    handler.down(at(100, 50));
    handler.move(at(260, 30));
    handler.up(at(260, 30));
    expect(arrow()).toMatchObject({ endBinding: 'b', endMode: 'inside', endAnchor: [0.6, 0.3] });
  });

  it('attaches an end dropped just outside to the edge', () => {
    const { handler, arrow } = withShape();
    handler.down(at(100, 50));
    handler.move(at(195, 30));
    handler.up(at(195, 30));
    expect(arrow()).toMatchObject({ endBinding: 'b' });
    expect(arrow()).not.toHaveProperty('endMode');
  });

  it('pins with Alt, even just outside', () => {
    const { handler, arrow } = withShape();
    handler.down(at(100, 50));
    handler.move(at(195, 30), { alt: true });
    handler.up(at(195, 30), { alt: true });
    expect(arrow()).toMatchObject({ endBinding: 'b', endMode: 'inside' });
  });

  it('leaves an end free with Cmd/Ctrl, even inside', () => {
    const { handler, arrow } = withShape();
    handler.down(at(100, 50));
    handler.move(at(260, 30), { mod: true });
    handler.up(at(260, 30), { mod: true });
    expect(arrow()).not.toHaveProperty('endBinding');
    expect(arrow()).not.toHaveProperty('endMode');
  });

  it('forgets a pin when the end moves to the edge', () => {
    const { handler, arrow } = withShape();
    handler.down(at(100, 50));
    handler.move(at(260, 30));
    handler.up(at(260, 30));
    handler.down(at(260, 30));
    handler.move(at(195, 30));
    handler.up(at(195, 30));
    expect(arrow()).not.toHaveProperty('endMode');
  });
});

// Decision 8 (06.13): point-edit mode, as Excalidraw's linear editor.
describe('editing the points of a line', () => {
  function editing(points = [0, 0, 100, 0, 200, 0]) {
    const history = createHistory({ elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 200, h: 0, z: 1, points }] as never });
    const selection = createSelection();
    selection.click('l');
    const handler = createPointerHandler({ history, selection, tools: createTools(), pointHit: () => 11, bendMinSegment: () => 40, bendInsertDistance: () => 10 });
    handler.editPoints('l');
    const world = () => {
      const e = history.current.elements[0] as unknown as { x: number; y: number; points: number[] };
      return e.points.map((v, i) => Math.round(v + (i % 2 === 0 ? e.x : e.y)));
    };
    return { handler, history, selection, world };
  }

  it('selects a point on click, and adds one with Shift', () => {
    const { handler } = editing();
    handler.down(at(100, 0));
    handler.up(at(100, 0));
    expect(handler.editingPoints).toEqual({ id: 'l', selected: [1] });
    handler.down(at(200, 0), { additive: true, shift: true });
    handler.up(at(200, 0), { shift: true });
    expect(handler.editingPoints).toEqual({ id: 'l', selected: [1, 2] });
  });

  it('moves the selected points together', () => {
    const { handler, world } = editing();
    handler.down(at(100, 0));
    handler.up(at(100, 0));
    handler.down(at(200, 0), { additive: true, shift: true });
    handler.up(at(200, 0), { shift: true });
    handler.down(at(200, 0));
    handler.move(at(200, 40));
    handler.up(at(200, 40));
    expect(world()).toEqual([0, 0, 100, 40, 200, 40]);
  });

  // Since 06.15 (P12, P13): the point before is selected after, and a line
  // left with fewer than two points is deleted, as Excalidraw's.
  it('removes the selected points, then selects the one before', () => {
    const { handler, world } = editing();
    handler.down(at(100, 0));
    handler.up(at(100, 0));
    expect(handler.removeSelectedPoints()).toBe(true);
    expect(world()).toEqual([0, 0, 200, 0]);
    expect(handler.editingPoints?.selected).toEqual([0]);
  });

  it('adds a point after the last on Alt-click', () => {
    const { handler, world } = editing();
    handler.down(at(260, 80), { alt: true });
    handler.up(at(260, 80), { alt: true });
    expect(world()).toEqual([0, 0, 100, 0, 200, 0, 260, 80]);
  });

  it('offers every segment middle while editing', () => {
    const { handler, world } = editing([0, 0, 100, 0, 200, 100]);
    handler.down(at(50, 0));
    handler.move(at(50, 60));
    handler.up(at(50, 60));
    expect(world()).toHaveLength(8);
  });

  it('ends with a press off the line, or when told to', () => {
    const { handler } = editing();
    handler.down(at(100, 300));
    handler.up(at(100, 300));
    expect(handler.editingPoints).toBeNull();
    handler.editPoints('l');
    handler.stopEditingPoints();
    expect(handler.editingPoints).toBeNull();
  });
});

// Outside the mode, only a two-point line or arrow offers its middle; a bent
// one's bends are added in the mode (Excalidraw interactiveScene.ts:1206-1217).
describe('a bent line outside point editing', () => {
  it('offers no middle to bend', () => {
    const history = createHistory({ elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 200, h: 100, z: 1, points: [0, 0, 100, 0, 200, 100] }] as never });
    const selection = createSelection();
    selection.click('l');
    const handler = createPointerHandler({ history, selection, tools: createTools(), pointHit: () => 11, bendMinSegment: () => 40, bendInsertDistance: () => 10 });
    handler.down(at(50, 0));
    handler.move(at(50, 60));
    handler.up(at(50, 60));
    expect((history.current.elements[0] as unknown as { points: number[] }).points).toHaveLength(6);
  });
});

// Decision 9 (06.13): click-by-click drawing, as Excalidraw's multi-point
// lines (App.tsx:10232-10256,11745-11781; LINE_CONFIRM_THRESHOLD 8).
describe('drawing a line by clicks', () => {
  function tool(kind: 'line' | 'arrow', elements: unknown[] = []) {
    const history = createHistory({ elements: elements as never });
    const tools = createTools();
    tools.activate(kind);
    const selection = createSelection();
    const handler = createPointerHandler({ history, selection, tools, minLinear: () => 20, confirmDistance: () => 8 });
    const click = (x: number, y: number) => {
      handler.down(at(x, y));
      handler.up(at(x, y));
    };
    const drawn = () => history.current.elements.find((e) => e.type === kind) as unknown as { x: number; y: number; points: number[] } & Record<string, unknown>;
    const world = () => drawn().points.map((v, i) => v + (i % 2 === 0 ? drawn().x : drawn().y));
    return { history, tools, selection, handler, click, drawn, world };
  }

  it('adds a point per click, and finishes on a click at the last point', () => {
    const { handler, click, world, tools, history } = tool('line');
    click(0, 0);
    expect(handler.drawingPoints).toBe(true);
    click(100, 0);
    click(100, 100);
    expect(history.current.elements).toHaveLength(0);
    click(103, 102);
    expect(handler.drawingPoints).toBe(false);
    expect(world()).toEqual([0, 0, 100, 0, 100, 100]);
    expect(tools.active).toBe('select');
  });

  it('finishes when told to (Enter or Escape)', () => {
    const { handler, click, world } = tool('line');
    click(0, 0);
    click(100, 0);
    handler.finishPoints();
    expect(world()).toEqual([0, 0, 100, 0]);
  });

  it('makes nothing from a single click finished at once', () => {
    const { handler, click, history } = tool('line');
    click(0, 0);
    handler.finishPoints();
    expect(history.current.elements).toHaveLength(0);
  });

  it('previews the next segment following the pointer', () => {
    const { handler, click } = tool('line');
    click(0, 0);
    click(100, 0);
    const preview = handler.pointsPreview(at(150, 50))!;
    const line = preview.elements.at(-1) as unknown as { x: number; y: number; points: number[] };
    expect(line.points.map((v, i) => v + (i % 2 === 0 ? line.x : line.y))).toEqual([0, 0, 100, 0, 150, 50]);
  });

  it('attaches a clicked arrow by its first and last points', () => {
    const shapes = [
      { id: 'a', type: 'rect', x: -50, y: -50, w: 100, h: 100, z: 1 },
      { id: 'b', type: 'rect', x: 250, y: -50, w: 100, h: 100, z: 2 },
    ];
    const { handler, click, drawn } = tool('arrow', shapes);
    click(0, 0);
    click(150, 120);
    click(300, 0);
    handler.finishPoints();
    expect(drawn()).toMatchObject({ startBinding: 'a', endBinding: 'b' });
  });

  it('still draws a two-point line from a drag', () => {
    const { handler, world } = tool('line');
    handler.down(at(0, 0));
    handler.move(at(100, 50));
    handler.up(at(100, 50));
    expect(handler.drawingPoints).toBe(false);
    expect(world()).toEqual([0, 0, 100, 50]);
  });
});

// The mode goes with the binding it qualifies: an arrow that lets go of a
// shape by a body drag, or an Alt-copy of one, keeps no pin.
describe('letting go of a pinned end', () => {
  function pinned() {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 },
        { id: 'arrow', type: 'arrow', x: 30, y: 30, w: 200, h: 0, z: 2, points: [0, 0, 200, 0], startBinding: 'a', startAnchor: [0.5, 0.5], startMode: 'inside' },
      ] as never,
    });
    const selection = createSelection();
    const handler = createPointerHandler({ history, selection, tools: createTools() });
    return { history, handler };
  }

  it('drops the mode with the binding on a body drag', () => {
    const { history, handler } = pinned();
    handler.down(at(150, 30));
    handler.move(at(150, 130));
    handler.up(at(150, 130));
    const arrow = history.current.elements.find((e) => e.id === 'arrow')!;
    expect(arrow).not.toHaveProperty('startBinding');
    expect(arrow).not.toHaveProperty('startMode');
  });

  it('drops the mode on an Alt-copy', () => {
    const { history, handler } = pinned();
    handler.down(at(150, 30));
    handler.up(at(150, 130), { alt: true });
    const copy = history.current.elements.find((e) => e.type === 'arrow' && e.id !== 'arrow')!;
    expect(copy).not.toHaveProperty('startMode');
  });
});

// Review of 06.13.
describe('review of 06.13: modes of the pointer', () => {
  const line = (points = [0, 0, 100, 0, 200, 0]) =>
    ({ id: 'l', type: 'line', x: 0, y: 0, w: 200, h: 0, z: 1, points }) as never;
  function kit(elements: unknown[], tool: Parameters<ReturnType<typeof createTools>['activate']>[0] = 'select') {
    const history = createHistory({ elements: elements as never });
    const tools = createTools();
    tools.activate(tool);
    const selection = createSelection();
    const handler = createPointerHandler({
      history, selection, tools, pointHit: () => 11, bendMinSegment: () => 40, bendInsertDistance: () => 10, minLinear: () => 20, confirmDistance: () => 8,
    });
    return { history, tools, selection, handler };
  }
  const allFinite = (history: ReturnType<typeof createHistory>) =>
    history.current.elements.every((e) => [e.x, e.y, e.w, e.h, ...(('points' in e ? e.points : []) as number[])].every(Number.isFinite));

  // Blocker 2: a drag while drawing click by click previews what it releases.
  it('previews a drag during click-by-click drawing as the line it extends', () => {
    const { history, handler } = kit([], 'line');
    handler.down(at(0, 0));
    handler.up(at(0, 0));
    handler.down(at(100, 0));
    handler.move(at(100, 50));
    // No separate line from the press: the drag previews nothing of its own,
    // and the app draws the line being clicked, running to the pointer.
    expect(handler.preview(at(100, 50))).toBeNull();
    expect(handler.pointsPreview(at(100, 50))!.elements).toHaveLength(1);
    handler.up(at(100, 50));
    handler.finishPoints();
    const drawn = history.current.elements[0] as unknown as { points: number[] };
    expect(drawn.points).toHaveLength(4);
  });

  // Blocker 3: stale selected indices never reach the points.
  it('never writes NaN after a point is added and undone', () => {
    const { history, selection, handler } = kit([line()]);
    selection.click('l');
    handler.editPoints('l');
    handler.down(at(260, 80), { alt: true });
    handler.up(at(260, 80), { alt: true });
    history.undo();
    handler.down(at(100, 0), { additive: true, shift: true });
    handler.move(at(100, 40), { shift: true });
    handler.up(at(100, 40), { shift: true });
    expect(allFinite(history)).toBe(true);
    expect(handler.editingPoints!.selected.every((i) => i < 3)).toBe(true);
  });

  it('attaches, not just moves, an arrow end dragged in point editing', () => {
    const { history, selection, handler } = kit([
      { id: 'b', type: 'rect', x: 300, y: -50, w: 100, h: 100, z: 1 },
      { id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 2, points: [0, 0, 100, 0, 200, 0] },
    ]);
    selection.click('a');
    handler.editPoints('a');
    handler.down(at(200, 0));
    handler.move(at(295, 0));
    handler.up(at(295, 0));
    expect(history.current.elements.find((e) => e.id === 'a')).toMatchObject({ endBinding: 'b' });
  });

  it('leaves point editing when the selection is no longer that line', () => {
    const { selection, handler } = kit([line(), { id: 'r', type: 'rect', x: 0, y: 100, w: 50, h: 50, z: 2 }]);
    selection.click('l');
    handler.editPoints('l');
    selection.click('r');
    expect(handler.editingPoints).toBeNull();
  });

  it('keeps the tool the user picks when that ends a click-by-click line', () => {
    const { history, tools, handler } = kit([], 'line');
    handler.down(at(0, 0));
    handler.up(at(0, 0));
    handler.down(at(100, 0));
    handler.up(at(100, 0));
    tools.activate('rect');
    handler.finishPoints({ keepTool: true });
    expect(tools.active).toBe('rect');
    expect(history.current.elements).toHaveLength(1);
  });

  it('answers Escape: finish a line being clicked, else leave point editing', () => {
    const { selection, handler } = kit([line()]);
    selection.click('l');
    handler.editPoints('l');
    expect(handler.escape()).toBe(true);
    expect(handler.editingPoints).toBeNull();
    expect(handler.escape()).toBe(false);
  });

  it('answers Enter on a selected line by editing its points', () => {
    const { selection, handler } = kit([line()]);
    selection.click('l');
    expect(handler.enter()).toBe(true);
    expect(handler.editingPoints).toEqual({ id: 'l', selected: [] });
  });

  // 06.15 P11, the user's answer: as Excalidraw, Delete with no point
  // selected does nothing (06.13 had it delete the line).
  it('lets Delete do nothing when no point is selected', () => {
    const { selection, handler } = kit([line()]);
    selection.click('l');
    handler.editPoints('l');
    expect(handler.deletePoints()).toBe(true);
    expect(handler.editingPoints).not.toBeNull();
  });

  it('enters point editing on a double-click: a line, or an arrow with Cmd/Ctrl, with Select only', () => {
    const { selection, handler, tools } = kit([line(), { id: 'a', type: 'arrow', x: 0, y: 100, w: 200, h: 0, z: 2, points: [0, 0, 200, 0] }]);
    expect(handler.doubleClick(at(100, 0))).toBe(true);
    expect(selection.ids).toEqual(['l']);
    handler.stopEditingPoints();
    expect(handler.doubleClick(at(100, 100))).toBe(false);
    expect(handler.doubleClick(at(100, 100), { mod: true })).toBe(true);
    handler.stopEditingPoints();
    tools.activate('line');
    expect(handler.doubleClick(at(100, 0))).toBe(false);
  });

  it('does not enter point editing on the double-click that finished a clicked line', () => {
    const { handler } = kit([], 'line');
    handler.down(at(0, 0));
    handler.up(at(0, 0));
    handler.down(at(100, 0));
    handler.up(at(100, 0));
    handler.down(at(101, 0));
    handler.up(at(101, 0));
    expect(handler.doubleClick(at(101, 0))).toBe(false);
  });

  it('records a pin on a drawn arrow ending inside a shape', () => {
    const { history, handler } = kit([{ id: 'b', type: 'rect', x: 200, y: -50, w: 100, h: 100, z: 1 }], 'arrow');
    handler.down(at(0, 0));
    handler.move(at(250, 0));
    handler.up(at(250, 0));
    expect(history.current.elements.find((e) => e.type === 'arrow')).toMatchObject({ endBinding: 'b', endMode: 'inside' });
  });

  it('leaves a drag free in preview when Cmd/Ctrl is pressed mid-drag', () => {
    const { handler } = kit([{ id: 'b', type: 'rect', x: 200, y: -50, w: 100, h: 100, z: 1 }], 'arrow');
    handler.down(at(0, 0));
    handler.move(at(250, 0));
    const free = handler.preview(at(250, 0), { mod: true })!.elements.find((e) => e.type === 'arrow')!;
    expect(free).not.toHaveProperty('endBinding');
  });
});

describe('review of 06.13, second pass', () => {
  it('returns to Select on Escape after a single click with the line tool', () => {
    const history = createHistory({ elements: [] });
    const tools = createTools();
    tools.activate('line');
    const handler = createPointerHandler({ history, selection: createSelection(), tools, minLinear: () => 20 });
    handler.down(at(0, 0));
    handler.up(at(0, 0));
    handler.escape();
    expect(tools.active).toBe('select');
    expect(history.current.elements).toHaveLength(0);
  });

  it('does not resize a bent line from a press that ends its point editing', () => {
    const history = createHistory({ elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 200, h: 100, z: 1, points: [0, 0, 100, 100, 200, 0] }] as never });
    const selection = createSelection();
    selection.click('l');
    const handler = createPointerHandler({ history, selection, tools: createTools(), handleSize: () => 4, pointHit: () => 11 });
    handler.editPoints('l');
    // The top-right corner of its box: a handle only outside the mode.
    handler.down(at(200, -40));
    handler.move(at(260, -80));
    handler.up(at(260, -80));
    expect(history.current.elements[0]).toMatchObject({ w: 200, h: 100 });
  });

  it('drags an attached arrow end as an end, even with Shift', () => {
    const history = createHistory({
      elements: [
        { id: 'b', type: 'rect', x: 300, y: -50, w: 100, h: 100, z: 1 },
        { id: 'a', type: 'arrow', x: 0, y: 0, w: 296, h: 0, z: 2, points: [0, 0, 100, 0, 296, 0], endBinding: 'b', endAnchor: [0, 0.5] },
      ] as never,
    });
    const selection = createSelection();
    selection.click('a');
    const handler = createPointerHandler({ history, selection, tools: createTools(), pointHit: () => 11 });
    handler.editPoints('a');
    handler.down(at(296, 0), { additive: true, shift: true });
    handler.move(at(150, 200), { shift: true });
    handler.up(at(150, 200), { shift: true });
    expect(history.current.elements.find((e) => e.id === 'a')).not.toHaveProperty('endBinding');
  });
});

// Decision 10 (06.14): a code block's height is the user's, never below its code.
describe('a code block made taller', () => {
  const metrics = { advance: 6, lineHeight: 20, padding: 8 };
  function block() {
    const history = createHistory({
      elements: [{ id: 'c', type: 'code', x: 0, y: 0, w: 112, h: 36, z: 1, code: 'abcdefghijklmnop', measuredWidth: 112, measuredHeight: 36 }] as never,
    });
    const selection = createSelection();
    selection.click('c');
    const handler = createPointerHandler({ history, selection, tools: createTools(), handleSize: () => 4, codeMetrics: () => metrics });
    return { history, handler, get: () => history.current.elements[0] as unknown as { w: number; h: number } };
  }

  it('stays taller when dragged taller from its bottom', () => {
    const { handler, get } = block();
    handler.down(at(56, 36));
    handler.move(at(56, 120));
    handler.up(at(56, 120));
    expect(get()).toMatchObject({ w: 112, h: 120 });
  });

  it('stops at its code when dragged shorter', () => {
    const { handler, get } = block();
    handler.down(at(56, 36));
    handler.move(at(56, 10));
    handler.up(at(56, 10));
    expect(get().h).toBe(36);
  });
});

// 06.14 E7 to E10 and S8: a selected elbow's segments each have a handle at
// their middle; dragging one moves it across itself and fixes it, and a
// double-click on a fixed one lets it go.
describe("dragging an elbow's segments", () => {
  function shaped() {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never,
        { id: 'b', type: 'rect', x: 300, y: 200, w: 100, h: 100, z: 2 } as never,
        {
          id: 'e',
          type: 'arrow',
          arrowType: 'elbow',
          x: 104,
          y: 50,
          w: 192,
          h: 200,
          z: 3,
          points: [0, 0, 126, 0, 126, 200, 192, 200],
          startBinding: 'a',
          startAnchor: [1, 0.5],
          endBinding: 'b',
          endAnchor: [0, 0.5],
          fixedSegments: [{ index: 2, start: [126, 0], end: [126, 200] }],
          label: 'label',
        } as never,
      );
    });
    kit.selection.click('e');
    const arrow = () => kit.history.current.elements.find((e) => e.id === 'e') as Record<string, unknown>;
    const world = () => {
      const e = arrow() as { x: number; y: number; points: number[] };
      return e.points.map((v, i) => v + (i % 2 === 0 ? e.x : e.y));
    };
    return { ...kit, arrow, world };
  }

  it('moves a middle segment across itself and keeps it fixed', () => {
    const { handler, world, arrow } = shaped();
    expect(world()).toEqual([104, 50, 230, 50, 230, 250, 296, 250]);
    handler.down(at(230, 150));
    handler.move(at(262, 170));
    handler.up(at(262, 170));
    expect(world()).toEqual([104, 50, 262, 50, 262, 250, 296, 250]);
    expect((arrow().fixedSegments as { index: number }[]).map((f) => f.index)).toEqual([2]);
  });

  it('adds a stub when the first segment is dragged', () => {
    const { handler, world } = shaped();
    handler.down(at(167, 50));
    handler.move(at(167, 20));
    handler.up(at(167, 20));
    expect(world().slice(0, 8)).toEqual([104, 50, 144, 50, 144, 20, 230, 20]);
  });

  it('changes nothing on a click', () => {
    const { handler, history } = shaped();
    const before = history.current;
    handler.down(at(230, 150));
    handler.up(at(230, 150));
    expect(history.current).toBe(before);
  });

  it('lets a fixed segment go on a double-click on its handle', () => {
    const { handler, arrow } = shaped();
    expect(handler.releaseSegmentAt(at(230, 150))).toBe(true);
    expect(arrow()).not.toHaveProperty('fixedSegments');
  });

  it('does nothing on a double-click on a free segment', () => {
    const { handler } = shaped();
    expect(handler.releaseSegmentAt(at(167, 50))).toBe(false);
  });

  // S8: the label sits over the middle of the path; the segment handle wins.
  it('takes the segment, not the label under it', () => {
    const { history, selection, world } = shaped();
    const tools = createTools();
    tools.activate('select');
    const handler = createPointerHandler({
      history,
      selection,
      tools,
      handleSize: () => 4,
      labelBounds: () => ({ x: 200, y: 130, w: 60, h: 40 }),
    });
    handler.down(at(230, 150));
    handler.move(at(262, 150));
    handler.up(at(262, 150));
    expect(world()[2]).toBe(262);
  });
});

// 06.14 E16: a bound elbow alone is not dragged by its body (Excalidraw's
// `dragElements.ts:46-67`); with others it moves only when both its shapes do.
describe('dragging a bound elbow by its body', () => {
  function scene() {
    const kit = harness('select');
    kit.history.mutate((draft) => {
      draft.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never,
        { id: 'b', type: 'rect', x: 300, y: 200, w: 100, h: 100, z: 2 } as never,
        { id: 'c', type: 'rect', x: 0, y: 400, w: 50, h: 50, z: 4 } as never,
        {
          id: 'e',
          type: 'arrow',
          arrowType: 'elbow',
          x: 104,
          y: 50,
          w: 192,
          h: 200,
          z: 3,
          points: [0, 0, 126, 0, 126, 200, 192, 200],
          startBinding: 'a',
          startAnchor: [1, 0.5],
          endBinding: 'b',
          endAnchor: [0, 0.5],
        } as never,
      );
    });
    const find = (id: string) => kit.history.current.elements.find((e) => e.id === id) as Record<string, unknown>;
    return { ...kit, find };
  }

  it('does not move it alone', () => {
    const { handler, history, selection } = scene();
    selection.click('e');
    const before = history.current;
    // On its first segment, away from the segment's middle.
    handler.down(at(120, 50));
    // Towards A: a marquee here would take A as well.
    handler.move(at(50, 90));
    handler.up(at(50, 90));
    expect(history.current).toBe(before);
    // Nor is the drag a marquee: the elbow stays selected.
    expect(selection.ids).toEqual(['e']);
  });

  it('leaves it out of a selection without both its shapes', () => {
    const { handler, selection, find } = scene();
    selection.click('e');
    selection.click('c', { additive: true });
    handler.down(at(25, 425));
    handler.move(at(25, 475));
    handler.up(at(25, 475));
    expect(find('c')).toMatchObject({ y: 450 });
    expect(find('e')).toMatchObject({ startBinding: 'a', endBinding: 'b', y: 50 });
  });
});

// 06.14 S2: a bent line's box, and so its handles, stand 10 clear of it.
describe("a bent line's padded box", () => {
  it('resizes from the padded corner, by the drag', () => {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push({ id: 'l', type: 'line', x: 0, y: 0, w: 200, h: 80, z: 1, points: [0, 0, 100, 80, 200, 0] } as never);
    });
    kit.selection.click('l');
    kit.handler.down(at(210, 90));
    kit.handler.move(at(230, 90));
    kit.handler.up(at(230, 90));
    expect(kit.history.current.elements[0]).toMatchObject({ x: 0, w: 220 });
  });
});


// 06.14 S13: a selected element that shows a box is hit anywhere in it
// (Excalidraw's `App.tsx:6824-6842`), so a bent line is grabbed by its box.
describe('grabbing a selected bent line', () => {
  function bent() {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push({ id: 'l', type: 'line', x: 0, y: 0, w: 200, h: 80, z: 1, points: [0, 0, 100, 80, 200, 0] } as never);
    });
    return kit;
  }

  it('moves it from anywhere in its box', () => {
    const { handler, history, selection } = bent();
    selection.click('l');
    handler.down(at(100, 20));
    handler.move(at(130, 20));
    handler.up(at(130, 20));
    expect(history.current.elements[0]).toMatchObject({ x: 30 });
  });

  // Review of 06.14: the grab area is the box as drawn, padded 10.
  it('moves it from the padding of its drawn box', () => {
    const { handler, history, selection } = bent();
    selection.click('l');
    handler.down(at(100, -9));
    handler.move(at(130, -9));
    handler.up(at(130, -9));
    expect(history.current.elements[0]).toMatchObject({ x: 30 });
  });

  it('takes only its path while not selected', () => {
    const { handler, history } = bent();
    handler.down(at(100, 20));
    handler.move(at(130, 20));
    handler.up(at(130, 20));
    expect(history.current.elements[0]).toMatchObject({ x: 0 });
  });
});

// 06.14 S7: which handle the pointer is over, for the stage's hover disc.
describe('the handle under the pointer', () => {
  it("is a selected arrow's end, a middle, or an elbow segment's handle", () => {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0] } as never,
        { id: 'e', type: 'arrow', arrowType: 'elbow', x: 0, y: 100, w: 200, h: 100, z: 2, points: [0, 0, 100, 0, 100, 100, 200, 100] } as never,
      );
    });
    kit.selection.click('a');
    expect(kit.handler.hoveredHandle(at(197, 2))).toEqual({ x: 200, y: 0 });
    expect(kit.handler.hoveredHandle(at(102, 1))).toEqual({ x: 100, y: 0 });
    expect(kit.handler.hoveredHandle(at(60, 30))).toBeNull();
    kit.selection.click('e');
    // The middle of the elbow's first segment, as routed when it was added.
    const e = kit.history.current.elements[1] as unknown as { x: number; y: number; points: number[] };
    const middle = { x: e.x + (e.points[0] + e.points[2]) / 2, y: e.y + (e.points[1] + e.points[3]) / 2 };
    expect(kit.handler.hoveredHandle(at(middle.x + 1, middle.y - 2))).toEqual(middle);
  });
});


// 06.14 S9: a selected two-point attached arrow shows each end's anchor as a
// disc; dragging it moves the anchor, onto another shape re-attaches, Alt
// pins it inside, and off every shape the end lets go there (Excalidraw's
// `arrows/focus.ts:211-340`).
describe("dragging an arrow end's anchor", () => {
  function aimed() {
    const kit = harness('select');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never,
        { id: 'c', type: 'rect', x: 0, y: 300, w: 100, h: 100, z: 2 } as never,
        { id: 'r', type: 'arrow', x: 104, y: 50, w: 200, h: 0, z: 3, points: [0, 0, 200, 0], startBinding: 'a', startAnchor: [0.5, 0.5] } as never,
      );
    });
    kit.selection.click('r');
    const arrow = () => kit.history.current.elements.find((e) => e.id === 'r') as Record<string, unknown>;
    return { ...kit, arrow };
  }

  it('moves the anchor within its shape', () => {
    const { handler, arrow } = aimed();
    handler.down(at(50, 50));
    handler.move(at(50, 20));
    handler.up(at(50, 20));
    expect(arrow()).toMatchObject({ startBinding: 'a', startAnchor: [0.5, 0.2] });
    expect(arrow()).not.toHaveProperty('startMode');
  });

  it('pins it inside with Alt', () => {
    const { handler, arrow } = aimed();
    handler.down(at(50, 50));
    handler.move(at(50, 20), { alt: true });
    handler.up(at(50, 20), { alt: true });
    expect(arrow()).toMatchObject({ startBinding: 'a', startMode: 'inside' });
  });

  it('re-attaches it to another shape', () => {
    const { handler, arrow } = aimed();
    handler.down(at(50, 50));
    handler.move(at(50, 350));
    handler.up(at(50, 350));
    expect(arrow()).toMatchObject({ startBinding: 'c', startAnchor: [0.5, 0.5] });
  });

  it('lets the end go where it is dropped off every shape', () => {
    const { handler, arrow } = aimed();
    handler.down(at(50, 50));
    handler.move(at(50, 200));
    handler.up(at(50, 200));
    expect(arrow()).not.toHaveProperty('startBinding');
    const r = arrow() as { x: number; y: number; points: number[] };
    expect([r.x + r.points[0], r.y + r.points[1]]).toEqual([50, 200]);
  });
});

// 06.14 S10, S11: what is under the pointer, for the cursor (`cursor.ts`).
describe('what the cursor is over', () => {
  function scene() {
    const kit = harness('select');
    kit.history.mutate((draft) => {
      draft.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never,
        { id: 'b', type: 'rect', x: 300, y: 200, w: 100, h: 100, z: 2 } as never,
        {
          id: 'e',
          type: 'arrow',
          arrowType: 'elbow',
          x: 104,
          y: 50,
          w: 192,
          h: 200,
          z: 3,
          points: [0, 0, 126, 0, 126, 200, 192, 200],
          startBinding: 'a',
          startAnchor: [1, 0.5],
          endBinding: 'b',
          endAnchor: [0, 0.5],
          fixedSegments: [{ index: 2, start: [126, 0], end: [126, 200] }],
        } as never,
      );
    });
    return kit;
  }

  it('names a box handle with the angle it is drawn at', () => {
    const { handler, selection } = scene();
    selection.click('a');
    expect(handler.cursorTarget(at(100, 100))).toEqual({ kind: 'resize', handle: 'bottom-right', angle: 0 });
  });

  it('names what a drag would move, and a bound elbow as not movable', () => {
    const { handler, selection } = scene();
    expect(handler.cursorTarget(at(50, 50))).toEqual({ kind: 'element', movable: true });
    expect(handler.cursorTarget(at(230, 120))).toEqual({ kind: 'element', movable: false });
    selection.click('e');
    expect(handler.cursorTarget(at(230, 150))).toEqual({ kind: 'segment' });
    expect(handler.cursorTarget(at(104, 50))).toEqual({ kind: 'point' });
  });

  it('is nothing over empty canvas', () => {
    const { handler } = scene();
    expect(handler.cursorTarget(at(200, 380))).toBeNull();
  });

  it('is the confirm zone at the last point while drawing by clicks', () => {
    const { handler, tools } = scene();
    tools.activate('line');
    handler.down(at(500, 500));
    handler.up(at(500, 500));
    handler.down(at(600, 500));
    handler.up(at(600, 500));
    expect(handler.cursorTarget(at(602, 501))).toEqual({ kind: 'confirm' });
    expect(handler.cursorTarget(at(650, 550))).toBeNull();
  });
});

// 06.15 C2, C5, C6, C19: drawing a line or arrow, as Excalidraw.
describe('drawing a line, as Excalidraw', () => {
  it('shows the line from the first move, and a short release goes on by clicks', () => {
    const { handler, history } = harness('line');
    handler.down(at(0, 0));
    handler.move(at(10, 0));
    const preview = handler.preview(at(10, 0));
    expect(preview?.elements.some((e) => e.type === 'line')).toBe(true);
    handler.up(at(10, 0));
    expect(handler.drawingPoints).toBe(true);
    expect(history.current.elements).toHaveLength(0);
  });

  it('hides the floating segment while the pointer is back on the last point', () => {
    const { handler } = harness('line');
    handler.down(at(0, 0));
    handler.up(at(0, 0));
    handler.down(at(100, 0));
    handler.up(at(100, 0));
    const line = (p: ReturnType<typeof handler.pointsPreview>) => p!.elements.find((e) => e.type === 'line') as unknown as { points: number[] };
    expect(line(handler.pointsPreview(at(103, 2))).points).toHaveLength(4);
    expect(line(handler.pointsPreview(at(150, 40))).points).toHaveLength(6);
  });

  it('snaps each clicked segment to 15° with Shift', () => {
    const { handler, history } = harness('line');
    handler.down(at(0, 0));
    handler.up(at(0, 0));
    handler.down(at(100, 4), { shift: true });
    handler.up(at(100, 4), { shift: true });
    handler.finishPoints();
    const line = history.current.elements[0] as unknown as { x: number; y: number; points: number[] };
    expect(line.points[3] - line.points[1]).toBe(0);
  });

  it('reads Alt and Cmd/Ctrl for the start at the press, for the end at the release', () => {
    const kit = harness('arrow');
    kit.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never,
        { id: 'b', type: 'rect', x: 300, y: 0, w: 100, h: 100, z: 2 } as never,
      );
    });
    // Alt at the press pins the start; the end, released without it just
    // outside B, attaches to B's edge.
    kit.handler.down(at(104, 50), { alt: true });
    kit.handler.move(at(296, 50));
    kit.handler.up(at(296, 50));
    const arrow = kit.history.current.elements.find((e) => e.type === 'arrow') as Record<string, unknown>;
    expect(arrow).toMatchObject({ startBinding: 'a', startMode: 'inside', endBinding: 'b' });
    expect(arrow).not.toHaveProperty('endMode');

    const free = harness('arrow');
    free.history.mutate((scene) => {
      scene.elements.push(
        { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never,
        { id: 'b', type: 'rect', x: 300, y: 0, w: 100, h: 100, z: 2 } as never,
      );
    });
    // Cmd/Ctrl at the press leaves the start free; released without it, the
    // end attaches.
    free.handler.down(at(104, 50), { mod: true });
    free.handler.move(at(296, 50), { mod: false });
    free.handler.up(at(296, 50));
    const loose = free.history.current.elements.find((e) => e.type === 'arrow') as Record<string, unknown>;
    expect(loose).not.toHaveProperty('startBinding');
    expect(loose).toMatchObject({ endBinding: 'b' });
  });
});

// 06.15 C7, C8: a clicked arrow finishes on a shape; a clicked line closes.
describe('finishing a line drawn by clicks', () => {
  const click = (handler: ReturnType<typeof harness>['handler'], x: number, y: number) => {
    handler.down(at(x, y));
    handler.up(at(x, y));
  };

  it('finishes an arrow when a click lands just outside a shape', () => {
    const kit = harness('arrow');
    kit.history.mutate((scene) => {
      scene.elements.push({ id: 'b', type: 'rect', x: 300, y: 0, w: 100, h: 100, z: 1 } as never);
    });
    click(kit.handler, 0, 50);
    click(kit.handler, 150, 200);
    click(kit.handler, 296, 50);
    expect(kit.handler.drawingPoints).toBe(false);
    const arrow = kit.history.current.elements.find((e) => e.type === 'arrow') as unknown as { endBinding: string; points: number[] };
    expect(arrow.endBinding).toBe('b');
    expect(arrow.points).toHaveLength(6);
  });

  it('adds a point, not a finish, for a click inside a shape', () => {
    const kit = harness('arrow');
    kit.history.mutate((scene) => {
      scene.elements.push({ id: 'b', type: 'rect', x: 300, y: 0, w: 100, h: 100, z: 1 } as never);
    });
    click(kit.handler, 0, 50);
    click(kit.handler, 350, 50);
    expect(kit.handler.drawingPoints).toBe(true);
  });

  it('closes a line clicked back on its first point', () => {
    const { handler, history } = harness('line');
    click(handler, 0, 0);
    click(handler, 100, 0);
    click(handler, 100, 100);
    click(handler, 3, 2);
    expect(handler.drawingPoints).toBe(false);
    const line = history.current.elements[0] as unknown as { closed?: boolean; points: number[] };
    expect(line.closed).toBe(true);
    expect(line.points.slice(-2)).toEqual(line.points.slice(0, 2));
    expect(line.points).toHaveLength(8);
  });

  it('finishes, open, a line of two points clicked back on its first', () => {
    const { handler, history } = harness('line');
    click(handler, 0, 0);
    click(handler, 100, 0);
    click(handler, 3, 2);
    const line = history.current.elements[0] as unknown as { closed?: boolean };
    expect(handler.drawingPoints).toBe(false);
    expect(line.closed).toBeUndefined();
  });
});

// 06.15 C9, C13, C16, C18: new elements, the tool lock, the pre-press highlight.
describe('what drawing makes', () => {
  it('gives a new element the style it is handed', () => {
    const history = createHistory({ elements: [] });
    const selection = createSelection();
    const tools = createTools();
    tools.activate('arrow');
    const handler = createPointerHandler({ history, selection, tools, newStyle: (type) => (type === 'arrow' ? { arrowType: 'arc', stroke: 'red' } : {}) });
    handler.down(at(0, 0));
    handler.move(at(100, 0));
    handler.up(at(100, 0));
    expect(history.current.elements[0]).toMatchObject({ arrowType: 'arc', stroke: 'red' });
  });

  it('finishes an elbow drawn by clicks on its second click', () => {
    const history = createHistory({ elements: [] });
    const tools = createTools();
    tools.activate('arrow');
    const handler = createPointerHandler({ history, selection: createSelection(), tools, newStyle: () => ({ arrowType: 'elbow' }) });
    handler.down(at(0, 0));
    handler.up(at(0, 0));
    handler.down(at(200, 100));
    handler.up(at(200, 100));
    expect(handler.drawingPoints).toBe(false);
    expect(history.current.elements[0]).toMatchObject({ type: 'arrow', arrowType: 'elbow' });
  });

  it('keeps the tool, with nothing selected, while the tool is locked', () => {
    const { handler, history, selection, tools } = harness('rect');
    tools.toggleLock();
    handler.down(at(0, 0));
    handler.move(at(50, 50));
    handler.up(at(50, 50));
    expect(history.current.elements).toHaveLength(1);
    expect(tools.active).toBe('rect');
    expect(selection.ids).toEqual([]);
  });

  it('outlines the shape under the pointer with the Arrow tool, before any press', () => {
    const { handler, history } = harness('arrow');
    history.mutate((scene) => {
      scene.elements.push({ id: 'b', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 } as never);
    });
    handler.move(at(50, 50));
    expect(handler.bindingCandidates).toEqual(['b']);
    handler.move(at(300, 300));
    expect(handler.bindingCandidates).toEqual([]);
  });
});

// 06.15 P7, P8, P10, P14, P15, P25: choosing and moving points, as
// Excalidraw's linear editor.
describe('choosing and moving points, as Excalidraw', () => {
  function editing(points = [0, 0, 100, 0, 200, 0]) {
    const history = createHistory({ elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 200, h: 0, z: 1, points }] as never });
    const selection = createSelection();
    selection.click('l');
    const handler = createPointerHandler({ history, selection, tools: createTools(), pointHit: () => 11, bendMinSegment: () => 40, bendInsertDistance: () => 10 });
    handler.editPoints('l');
    const world = () => {
      const e = history.current.elements[0] as unknown as { x: number; y: number; points: number[] };
      return e.points.map((v, i) => Math.round(v + (i % 2 === 0 ? e.x : e.y)));
    };
    const pick = (x: number, y: number, shift = false) => {
      handler.down(at(x, y), { additive: shift, shift });
      handler.up(at(x, y), { shift });
    };
    return { handler, history, selection, world, pick };
  }

  it('drops a selected point on Shift-click, but keeps it for a Shift-drag', () => {
    const { handler, pick, world } = editing();
    pick(100, 0);
    pick(200, 0, true);
    handler.down(at(100, 0), { additive: true, shift: true });
    handler.move(at(100, 30), { shift: true });
    handler.up(at(100, 30), { shift: true });
    expect(world()).toEqual([0, 0, 100, 30, 200, 30]);
    pick(200, 30, true);
    expect(handler.editingPoints?.selected).toEqual([1]);
  });

  it('selects the points inside a box dragged off the line, Shift adding', () => {
    const { handler, pick } = editing([0, 0, 100, 0, 200, 0, 300, 0]);
    handler.down(at(80, -20));
    handler.move(at(220, 20));
    handler.up(at(220, 20));
    expect(handler.editingPoints?.selected).toEqual([1, 2]);
    pick(0, 0);
    handler.down(at(280, -20), { additive: true, shift: true });
    handler.move(at(320, 20), { shift: true });
    handler.up(at(320, 20), { shift: true });
    expect(handler.editingPoints?.selected).toEqual([0, 3]);
  });

  it('snaps one dragged point to 15° about its neighbour with Shift', () => {
    const { handler, world } = editing([0, 0, 100, 0]);
    handler.down(at(100, 0));
    handler.move(at(100, 4), { shift: true });
    handler.up(at(100, 4), { shift: true });
    expect(world()).toEqual([0, 0, 100, 0]);
  });

  it('adds a point at an Alt-press and drags it with the same press', () => {
    const { handler, world } = editing();
    handler.down(at(260, 80), { alt: true });
    handler.move(at(280, 100), { alt: true });
    handler.up(at(280, 100), { alt: true });
    expect(world()).toEqual([0, 0, 100, 0, 200, 0, 280, 100]);
    expect(handler.editingPoints?.selected).toEqual([3]);
  });

  it('previews the next point while Alt is held, Shift snapping it', () => {
    const { handler, history } = editing();
    const where = (preview: ReturnType<typeof handler.appendPreview>) => {
      const line = preview!.elements[0] as unknown as { x: number; y: number; points: number[] };
      return line.points.slice(-2).map((v, i) => Math.round(v + (i === 0 ? line.x : line.y)));
    };
    expect(where(handler.appendPreview(at(260, 80)))).toEqual([260, 80]);
    // 100 along and 4 up from (200, 0) snaps flat.
    expect(where(handler.appendPreview(at(300, 4), { shift: true }))).toEqual([300, 0]);
    expect((history.current.elements[0] as unknown as { points: number[] }).points).toHaveLength(6);
  });

  it('adds a point at a middle at once, not after 10 px', () => {
    const { handler, world } = editing();
    handler.down(at(50, 0));
    handler.move(at(50, 5));
    handler.up(at(50, 5));
    expect(world()).toEqual([0, 0, 50, 5, 100, 0, 200, 0]);
  });

  it('moves the whole line when the line itself is dragged', () => {
    const { handler, world } = editing();
    // On the line, clear of its points and middles.
    handler.down(at(125, 0));
    handler.move(at(125, 40));
    handler.up(at(125, 40));
    expect(world()).toEqual([0, 40, 100, 40, 200, 40]);
    expect(handler.editingPoints).not.toBeNull();
  });
});

// 06.15 P11, P13, P16, P17: removing and duplicating points, as Excalidraw.
describe('removing and duplicating points, as Excalidraw', () => {
  function editing(points = [0, 0, 100, 0, 200, 0]) {
    const history = createHistory({ elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 200, h: 0, z: 1, points }] as never });
    const selection = createSelection();
    selection.click('l');
    const handler = createPointerHandler({ history, selection, tools: createTools(), pointHit: () => 11, bendMinSegment: () => 40, bendInsertDistance: () => 10 });
    handler.editPoints('l');
    const world = () => {
      const e = history.current.elements[0] as unknown as { x: number; y: number; points: number[] };
      return e.points.map((v, i) => Math.round(v + (i % 2 === 0 ? e.x : e.y)));
    };
    const pick = (x: number, y: number, shift = false) => {
      handler.down(at(x, y), { additive: shift, shift });
      handler.up(at(x, y), { shift });
    };
    return { handler, history, world, pick };
  }

  it('does nothing on Delete with no point selected, and stays editing', () => {
    const { handler, history } = editing();
    const before = history.current;
    expect(handler.deletePoints()).toBe(true);
    expect(history.current).toBe(before);
    expect(handler.editingPoints).not.toBeNull();
  });

  it('deletes the line when too few points would be left', () => {
    const { handler, history, pick } = editing();
    pick(0, 0);
    pick(100, 0, true);
    expect(handler.deletePoints()).toBe(true);
    expect(history.current.elements).toHaveLength(0);
    expect(handler.editingPoints).toBeNull();
  });

  it('duplicates each selected point halfway to the next, the last 30, 30 away', () => {
    const { handler, world, pick } = editing();
    pick(100, 0);
    pick(200, 0, true);
    expect(handler.duplicatePoints()).toBe(true);
    expect(world()).toEqual([0, 0, 100, 0, 150, 0, 200, 0, 230, 30]);
    expect(handler.editingPoints?.selected).toEqual([2, 4]);
  });

  it('does nothing on Select All while editing points', () => {
    const { handler, pick } = editing();
    pick(100, 0);
    expect(handler.selectAll()).toBe(true);
    expect(handler.editingPoints).toEqual({ id: 'l', selected: [1] });
  });
});


// 06.15 P18, P20: closing a line by its ends, and keeping it closed.
describe('a closed line', () => {
  it('closes when an end is dragged onto the other', () => {
    const { handler, history, selection } = harness('select');
    history.mutate((scene) => {
      scene.elements.push({ id: 'l', type: 'line', x: 0, y: 0, w: 100, h: 100, z: 1, points: [0, 0, 100, 0, 100, 100] } as never);
    });
    selection.click('l');
    handler.down(at(100, 100));
    handler.move(at(4, 3));
    handler.up(at(4, 3));
    const line = history.current.elements[0] as unknown as { closed?: boolean; x: number; y: number; points: number[] };
    expect(line.closed).toBe(true);
    expect(line.points.slice(-2)).toEqual(line.points.slice(0, 2));
  });

  it('moves its first and last point together', () => {
    const { handler, history, selection } = harness('select');
    history.mutate((scene) => {
      scene.elements.push({ id: 'l', type: 'line', x: 0, y: 0, w: 100, h: 100, z: 1, points: [0, 0, 100, 0, 100, 100, 0, 0], closed: true } as never);
    });
    selection.click('l');
    handler.editPoints('l');
    handler.down(at(0, 0));
    handler.move(at(-20, -10));
    handler.up(at(-20, -10));
    const line = history.current.elements[0] as unknown as { x: number; y: number; points: number[] };
    const world = line.points.map((v, i) => v + (i % 2 === 0 ? line.x : line.y));
    expect(world.slice(0, 2)).toEqual([-20, -10]);
    expect(world.slice(-2)).toEqual([-20, -10]);
  });

  it('stays closed when its first point is deleted', () => {
    const { handler, history, selection } = harness('select');
    history.mutate((scene) => {
      scene.elements.push({ id: 'l', type: 'line', x: 0, y: 0, w: 100, h: 100, z: 1, points: [0, 0, 100, 0, 100, 100, 0, 100, 0, 0], closed: true } as never);
    });
    selection.click('l');
    handler.editPoints('l');
    handler.down(at(0, 0));
    handler.up(at(0, 0));
    handler.removeSelectedPoints();
    const line = history.current.elements[0] as unknown as { closed?: boolean; x: number; y: number; points: number[] };
    const world = line.points.map((v, i) => v + (i % 2 === 0 ? line.x : line.y));
    expect(line.closed).toBe(true);
    expect(world).toEqual([100, 0, 100, 100, 0, 100, 100, 0]);
  });

  it('takes an Alt-added point before its closing one', () => {
    const { handler, history, selection } = harness('select');
    history.mutate((scene) => {
      scene.elements.push({ id: 'l', type: 'line', x: 0, y: 0, w: 100, h: 100, z: 1, points: [0, 0, 100, 0, 100, 100, 0, 0], closed: true } as never);
    });
    selection.click('l');
    handler.editPoints('l');
    handler.down(at(-40, 80), { alt: true });
    handler.up(at(-40, 80), { alt: true });
    const line = history.current.elements[0] as unknown as { x: number; y: number; points: number[] };
    const world = line.points.map((v, i) => v + (i % 2 === 0 ? line.x : line.y));
    expect(world).toEqual([0, 0, 100, 0, 100, 100, -40, 80, 0, 0]);
  });
});

// Review of 06.15: closed lines through duplicate and delete, the Alt-added
// point's selection, and Duplicate with nothing selected.
describe('point editing, from the 06.15 review', () => {
  function loop(points: number[]) {
    const { handler, history, selection } = harness('select');
    history.mutate((scene) => {
      scene.elements.push({ id: 'l', type: 'line', x: 0, y: 0, w: 100, h: 100, z: 1, points, closed: true } as never);
    });
    selection.click('l');
    handler.editPoints('l');
    const world = () => {
      const e = history.current.elements[0] as unknown as { x: number; y: number; points: number[] };
      return e ? e.points.map((v, i) => Math.round(v + (i % 2 === 0 ? e.x : e.y))) : null;
    };
    const pick = (x: number, y: number, shift = false) => {
      handler.down(at(x, y), { additive: shift, shift });
      handler.up(at(x, y), { shift });
    };
    return { handler, history, world, pick };
  }

  it('duplicates the joined corner of a loop towards its second point, still closed', () => {
    const { handler, history, world, pick } = loop([0, 0, 100, 0, 100, 100, 0, 0]);
    pick(0, 0);
    expect(handler.duplicatePoints()).toBe(true);
    expect(world()).toEqual([0, 0, 50, 0, 100, 0, 100, 100, 0, 0]);
    expect(history.current.elements[0]).toMatchObject({ closed: true });
  });

  it('deletes a loop left with fewer than two distinct points', () => {
    const { handler, history, pick } = loop([0, 0, 100, 0, 100, 100, 0, 0]);
    pick(100, 0);
    pick(100, 100, true);
    handler.removeSelectedPoints();
    expect(history.current.elements).toHaveLength(0);
  });

  it('selects the point before the first removed, in the new numbering', () => {
    const { handler, world, pick } = loop([0, 0, 100, 0, 100, 100, 0, 100, 0, 0]);
    pick(0, 0);
    handler.removeSelectedPoints();
    expect(world()).toEqual([100, 0, 100, 100, 0, 100, 100, 0]);
    // The corner at (0, 100) was before the removed one; it is index 2 now.
    expect(handler.editingPoints?.selected).toEqual([2]);
  });

  it('keeps an Alt-added point selected when the mode is read mid-press', () => {
    const { handler, history, selection } = harness('select');
    history.mutate((scene) => {
      scene.elements.push({ id: 'l', type: 'line', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 100, 0, 200, 0] } as never);
    });
    selection.click('l');
    handler.editPoints('l');
    handler.down(at(260, 80), { alt: true });
    void handler.editingPoints;
    handler.move(at(280, 100), { alt: true });
    void handler.editingPoints;
    handler.up(at(280, 100), { alt: true });
    expect(handler.editingPoints?.selected).toEqual([3]);
  });

  it('takes Duplicate in point editing even with no point selected', () => {
    const { handler, history } = loop([0, 0, 100, 0, 100, 100, 0, 0]);
    const before = history.current;
    expect(handler.duplicatePoints()).toBe(true);
    expect(history.current).toBe(before);
  });
});

// Review of 06.15: the pen and a code block take the last style too.
describe('the style of a pen stroke and a code block', () => {
  it('is the one handed for their kind', () => {
    const history = createHistory({ elements: [] });
    const tools = createTools();
    const handler = createPointerHandler({ history, selection: createSelection(), tools, newStyle: (type) => ({ stroke: `${type}-red` }) });
    tools.activate('pen');
    handler.down(at(0, 0));
    handler.move(at(40, 30));
    handler.up(at(40, 30));
    expect(history.current.elements[0]).toMatchObject({ type: 'stroke', stroke: 'stroke-red' });
    tools.activate('code');
    handler.down(at(200, 200));
    handler.up(at(200, 200));
    expect(history.current.elements[1]).toMatchObject({ type: 'code', stroke: 'code-red' });
  });
});

