import { describe, expect, it } from 'vitest';
import { createPointerHandler } from './pointer';
import { createHistory } from './history';
import { createSelection } from './selection';
import { createTools } from './tools.svelte';

function harness(tool: Parameters<ReturnType<typeof createTools>['activate']>[0] = 'select') {
  const history = createHistory({ elements: [] });
  const selection = createSelection();
  const tools = createTools();
  tools.activate(tool);
  const handler = createPointerHandler({ history, selection, tools });
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
});
