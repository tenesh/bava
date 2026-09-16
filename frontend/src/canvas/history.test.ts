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
