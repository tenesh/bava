import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { boundsOf, group, paste, ungroup, PASTE_OFFSET } from './edit';

function threeRects() {
  const scene = createScene();
  const a = scene.add({ type: 'rect', x: 0, y: 0, w: 50, h: 50 });
  const b = scene.add({ type: 'rect', x: 100, y: 20, w: 50, h: 50 });
  const c = scene.add({ type: 'rect', x: 400, y: 400, w: 10, h: 10 });
  return { scene, a, b, c };
}

describe('bounds', () => {
  it('covers every element', () => {
    const { scene } = threeRects();
    expect(boundsOf(scene.data().elements)).toEqual({ x: 0, y: 0, w: 410, h: 410 });
  });

  it('is empty for no elements', () => {
    expect(boundsOf([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('grouping', () => {
  // Grouping must not move anything. A group that nudges its contents is the
  // kind of bug that is noticed only after the drawing is already wrong.
  it('preserves relative geometry', () => {
    const { scene, a, b } = threeRects();
    const before = [scene.get(a.id), scene.get(b.id)].map((e) => ({ x: e!.x, y: e!.y }));

    group(scene, [a.id, b.id]);

    const after = [scene.get(a.id), scene.get(b.id)].map((e) => ({ x: e!.x, y: e!.y }));
    expect(after).toEqual(before);
  });

  it('creates a group covering its children', () => {
    const { scene, a, b } = threeRects();
    const created = group(scene, [a.id, b.id]);
    expect(created?.type).toBe('group');
    expect(created).toMatchObject({ x: 0, y: 0, w: 150, h: 70 });
  });

  it('refuses to group fewer than two elements', () => {
    const { scene, a } = threeRects();
    expect(group(scene, [a.id])).toBeUndefined();
  });

  it('restores the original elements on ungroup', () => {
    const { scene, a, b } = threeRects();
    const before = scene.serialise();
    const created = group(scene, [a.id, b.id])!;
    ungroup(scene, created.id);
    // The group is gone and its children are untouched.
    expect(scene.get(created.id)).toBeUndefined();
    expect(scene.get(a.id)).toBeDefined();
    expect(scene.get(b.id)).toBeDefined();
    expect(JSON.parse(scene.serialise()).elements).toHaveLength(
      JSON.parse(before).elements.length,
    );
  });
});

describe('paste', () => {
  // A copy landing exactly on its original looks like nothing happened.
  it('offsets the copy so it is visible', () => {
    const { scene, a } = threeRects();
    const original = scene.get(a.id)!;
    const [copy] = paste(scene, [original]);
    expect(copy.x).toBe(original.x + PASTE_OFFSET);
    expect(copy.y).toBe(original.y + PASTE_OFFSET);
  });

  it('gives the copy a new identity', () => {
    const { scene, a } = threeRects();
    const original = scene.get(a.id)!;
    const [copy] = paste(scene, [original]);
    expect(copy.id).not.toBe(original.id);
    expect(scene.get(original.id)).toBeDefined();
  });

  it('pastes a multi-element selection as a unit', () => {
    const { scene, a, b } = threeRects();
    const source = [scene.get(a.id)!, scene.get(b.id)!];
    const copies = paste(scene, source);
    expect(copies).toHaveLength(2);
    // Relative spacing survives the offset.
    expect(copies[1].x - copies[0].x).toBe(source[1].x - source[0].x);
  });
});
