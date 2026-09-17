import { describe, expect, it } from 'vitest';
import { createSelection, intersects } from './selection';
import { createScene } from './scene';

function sceneWithThree() {
  const scene = createScene();
  const a = scene.add({ type: 'rect', x: 0, y: 0, w: 50, h: 50 });
  const b = scene.add({ type: 'rect', x: 100, y: 0, w: 50, h: 50 });
  const c = scene.add({ type: 'rect', x: 200, y: 0, w: 50, h: 50 });
  return { scene, a, b, c };
}

describe('selection', () => {
  it('replaces the selection on a plain click', () => {
    const { a, b } = sceneWithThree();
    const selection = createSelection();
    selection.click(a.id);
    selection.click(b.id);
    expect(selection.ids).toEqual([b.id]);
  });

  it('adds to the selection on shift-click', () => {
    const { a, b } = sceneWithThree();
    const selection = createSelection();
    selection.click(a.id);
    selection.click(b.id, { additive: true });
    expect(new Set(selection.ids)).toEqual(new Set([a.id, b.id]));
  });

  it('removes an already selected element on shift-click', () => {
    const { a, b } = sceneWithThree();
    const selection = createSelection();
    selection.click(a.id);
    selection.click(b.id, { additive: true });
    selection.click(a.id, { additive: true });
    expect(selection.ids).toEqual([b.id]);
  });

  it('clears on escape', () => {
    const { a } = sceneWithThree();
    const selection = createSelection();
    selection.click(a.id);
    selection.clear();
    expect(selection.ids).toEqual([]);
  });

  it('selects everything intersecting a marquee', () => {
    const { scene, a, b } = sceneWithThree();
    const selection = createSelection();
    // A band covering the first two rects and stopping short of the third.
    selection.marquee({ x: -10, y: -10, w: 170, h: 70 }, scene.data());
    expect(new Set(selection.ids)).toEqual(new Set([a.id, b.id]));
  });

  it('treats a touching edge as intersecting', () => {
    const { scene, a } = sceneWithThree();
    const selection = createSelection();
    selection.marquee({ x: 50, y: 0, w: 10, h: 10 }, scene.data());
    expect(selection.ids).toContain(a.id);
  });

  it('selects all', () => {
    const { scene } = sceneWithThree();
    const selection = createSelection();
    selection.selectAll(scene.data());
    expect(selection.ids).toHaveLength(3);
  });

  // Milestone 1 left an interactive affordance with no keyboard path. Scene
  // elements get one here; a node *inside* a diagram waits for Milestone 6,
  // because diagram elements do not exist yet.
  it('steps through every element with the keyboard', () => {
    const { scene, a, b, c } = sceneWithThree();
    const selection = createSelection();
    const data = scene.data();

    selection.selectNext(data);
    expect(selection.ids).toEqual([a.id]);
    selection.selectNext(data);
    expect(selection.ids).toEqual([b.id]);
    selection.selectNext(data);
    expect(selection.ids).toEqual([c.id]);
    selection.selectNext(data);
    expect(selection.ids).toEqual([a.id]);
  });

  it('steps backwards too', () => {
    const { scene, a, c } = sceneWithThree();
    const selection = createSelection();
    const data = scene.data();
    selection.selectNext(data);
    expect(selection.ids).toEqual([a.id]);
    selection.selectPrevious(data);
    expect(selection.ids).toEqual([c.id]);
  });

  it('does nothing keyboard-wise in an empty scene', () => {
    const selection = createSelection();
    const empty = createScene().data();
    expect(() => selection.selectNext(empty)).not.toThrow();
    expect(selection.ids).toEqual([]);
  });
});

describe('intersects', () => {
  it('is false for disjoint boxes', () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it('is true for overlap', () => {
    expect(intersects({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });

  it('is true for containment', () => {
    expect(intersects({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 5, h: 5 })).toBe(true);
  });

  // Undo can remove a selected element; its id must not stay selected.
  it('retain drops ids that no longer exist', () => {
    const selection = createSelection();
    selection.click('a');
    selection.click('b', { additive: true });
    selection.retain(['b', 'c']);
    expect(selection.ids).toEqual(['b']);
  });
});
