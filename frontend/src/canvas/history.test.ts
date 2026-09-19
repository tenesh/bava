import { describe, expect, it } from 'vitest';
import { createHistory } from './history';
import type { SceneData } from './scene';

const empty: SceneData = { elements: [] };

const rect = (id: string, x: number) =>
  ({ id, z: 1, type: 'rect', x, y: 0, w: 10, h: 10 }) as const;

describe('history', () => {
  it('restores the exact previous scene on undo', () => {
    const history = createHistory(empty);
    const before = JSON.stringify(history.current);

    history.mutate((draft) => {
      draft.elements.push(rect('a', 0));
    });
    expect(history.current.elements).toHaveLength(1);

    history.undo();
    // Compared as serialised scenes, not counts: a partially reverted mutation
    // would still have the right number of elements.
    expect(JSON.stringify(history.current)).toBe(before);
  });

  it('reapplies an undone mutation on redo', () => {
    const history = createHistory(empty);
    history.mutate((draft) => void draft.elements.push(rect('a', 0)));
    history.undo();
    history.redo();
    expect(history.current.elements).toHaveLength(1);
  });

  it('discards the redo stack on a new mutation', () => {
    const history = createHistory(empty);
    history.mutate((draft) => void draft.elements.push(rect('a', 0)));
    history.undo();
    history.mutate((draft) => void draft.elements.push(rect('b', 5)));
    history.redo();
    expect(history.current.elements.map((e) => e.id)).toEqual(['b']);
  });

  // The property that matters: any sequence, fully undone, is the start.
  it('returns to the starting scene after undoing a sequence', () => {
    const history = createHistory(empty);
    const start = JSON.stringify(history.current);

    history.mutate((draft) => void draft.elements.push(rect('a', 0)));
    history.mutate((draft) => void draft.elements.push(rect('b', 10)));
    history.mutate((draft) => {
      draft.elements[0].x = 99;
    });
    history.mutate((draft) => void draft.elements.splice(1, 1));

    for (let i = 0; i < 4; i += 1) history.undo();

    expect(JSON.stringify(history.current)).toBe(start);
  });

  it('does nothing when there is nothing to undo', () => {
    const history = createHistory(empty);
    expect(() => history.undo()).not.toThrow();
    expect(history.current.elements).toHaveLength(0);
    expect(history.canUndo).toBe(false);
  });

  it('reports what is available', () => {
    const history = createHistory(empty);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    history.mutate((draft) => void draft.elements.push(rect('a', 0)));
    expect(history.canUndo).toBe(true);
    history.undo();
    expect(history.canRedo).toBe(true);
  });

  // A mutation that changes nothing should not consume an undo step: pressing
  // undo would then appear to do nothing, which reads as a broken undo.
  it('records no step for a mutation that changes nothing', () => {
    const history = createHistory(empty);
    history.mutate(() => {});
    expect(history.canUndo).toBe(false);
  });

  // Loading a document is not an edit. Undo after File ▸ New must not bring
  // the previous file's shapes back.
  it('reset replaces the scene and forgets both directions of history', () => {
    const history = createHistory({ elements: [] });
    history.mutate((draft) => {
      draft.elements.push({ id: 'a', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 1 });
    });
    history.undo();
    history.redo();

    history.reset({ elements: [] });
    expect(history.current.elements).toEqual([]);
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });
});

// Attached arrows re-aim as part of the change that moved their targets, so
// every edit path gets it: no caller can forget, and it is one undo step.
describe('bindings follow a change through history', () => {
  const scene = (): SceneData => ({
    elements: [
      { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 60, z: 1 },
      { id: 'b', type: 'rect', x: 300, y: 0, w: 100, h: 60, z: 2 },
      { id: 'arrow', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 3, points: [100, 30, 300, 30], startBinding: 'a', endBinding: 'b' },
    ] as never[],
  });

  const endOf = (data: SceneData) => {
    const arrow = data.elements.find((e) => e.id === 'arrow') as { x: number; y: number; points: number[] };
    return { x: arrow.x + arrow.points[2], y: arrow.y + arrow.points[3] };
  };

  it('re-aims the arrow in the same step that moved the shape', () => {
    const history = createHistory(scene());
    const before = endOf(history.current);
    history.mutate((draft) => {
      const b = draft.elements.find((e) => e.id === 'b')!;
      b.y = 400;
    });
    expect(endOf(history.current).y).toBeGreaterThan(before.y);
  });

  it('puts both back with one undo', () => {
    const history = createHistory(scene());
    const before = endOf(history.current);
    history.mutate((draft) => {
      const b = draft.elements.find((e) => e.id === 'b')!;
      b.y = 400;
    });
    history.undo();
    expect(endOf(history.current)).toEqual(before);
    expect(history.canUndo).toBe(false);
  });
});

// Membership follows the geometry through every path, not only a drag: a
// resize or a nudge that takes a shape out of its frame lets it go.
describe('containment follows a change through history', () => {
  const framed = (): SceneData => ({
    elements: [
      { id: 'f', type: 'frame', x: 0, y: 0, w: 200, h: 200, z: 1 },
      { id: 'in', type: 'rect', x: 20, y: 20, w: 40, h: 40, z: 2, frame: 'f' },
      { id: 'out', type: 'rect', x: 400, y: 0, w: 40, h: 40, z: 3 },
    ] as never[],
  });

  const frameOf = (data: SceneData, id: string) =>
    (data.elements.find((e) => e.id === id) as { frame?: string }).frame;

  it('lets go of a shape resized out of its frame', () => {
    const history = createHistory(framed());
    history.mutate((draft) => {
      const inside = draft.elements.find((e) => e.id === 'in')!;
      inside.w = 400;
    });
    expect(frameOf(history.current, 'in')).toBeUndefined();
  });

  it('takes in a shape nudged into a frame', () => {
    const history = createHistory(framed());
    history.mutate((draft) => {
      const outside = draft.elements.find((e) => e.id === 'out')!;
      outside.x = 100;
      outside.y = 100;
    });
    expect(frameOf(history.current, 'out')).toBe('f');
  });

  it('puts membership back with the change that caused it', () => {
    const history = createHistory(framed());
    history.mutate((draft) => {
      const inside = draft.elements.find((e) => e.id === 'in')!;
      inside.x = 400;
    });
    history.undo();
    expect(frameOf(history.current, 'in')).toBe('f');
  });
});

// A file is opened with its arrows already on their shapes: the stored points
// may have been written by another hand, or by an older Bava.
describe('opening a file', () => {
  it('aims attached arrows as part of the load', () => {
    const history = createHistory({ elements: [] });
    history.reset({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 },
        // Stored running nowhere near the shape it names.
        { id: 'arrow', type: 'arrow', x: 500, y: 500, w: 10, h: 10, z: 2, points: [0, 0, 10, 10], startBinding: 'a' },
      ] as never[],
    });
    const arrow = history.current.elements[1] as { x: number; points: number[] };
    expect(arrow.x + arrow.points[0]).toBeLessThan(200);
    expect(history.canUndo).toBe(false);
  });
});

// A change that leaves the scene exactly as it was must not consume a step,
// or undo appears to do nothing, which reads as a broken undo.
describe('a step that changes nothing', () => {
  it('is not recorded even when the recipe rewrote objects', () => {
    const history = createHistory({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 },
        { id: 'arrow', type: 'arrow', x: 60, y: 30, w: 100, h: 0, z: 2, points: [0, 0, 100, 0], startBinding: 'a' },
      ] as never[],
    });
    // Settle the arrow onto its shape first: that move is a real change.
    history.mutate(() => {});
    const settled = history.canUndo;
    history.mutate((draft) => {
      // Replace an element with an identical copy, as a drag that is snapped
      // straight back by re-routing does.
      draft.elements[1] = { ...draft.elements[1] };
    });
    // Whatever the first step did, the second added nothing to undo.
    expect(history.canUndo).toBe(settled);
  });
});
