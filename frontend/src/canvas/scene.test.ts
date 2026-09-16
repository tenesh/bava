import { describe, expect, it } from 'vitest';
import { createScene, type RectElement, type TextElement } from './scene';

const rect = (over: Partial<RectElement> = {}): Omit<RectElement, 'id' | 'z'> => ({
  type: 'rect',
  x: 0,
  y: 0,
  w: 100,
  h: 60,
  ...over,
});

const text = (over: Partial<TextElement> = {}): Omit<TextElement, 'id' | 'z'> => ({
  type: 'text',
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  text: 'hello',
  measuredWidth: 42,
  measuredHeight: 17,
  ...over,
});

describe('scene', () => {
  it('assigns a stable id on add', () => {
    const scene = createScene();
    const a = scene.add(rect());
    const b = scene.add(rect());
    expect(a.id).not.toBe(b.id);
    expect(scene.get(a.id)?.id).toBe(a.id);
  });

  it('orders by insertion and lets z-order change', () => {
    const scene = createScene();
    const a = scene.add(rect());
    const b = scene.add(rect());
    expect(scene.ordered().map((e) => e.id)).toEqual([a.id, b.id]);

    scene.bringToFront(a.id);
    expect(scene.ordered().map((e) => e.id)).toEqual([b.id, a.id]);

    scene.sendToBack(a.id);
    expect(scene.ordered().map((e) => e.id)).toEqual([a.id, b.id]);
  });

  it('leaves other elements untouched on remove', () => {
    const scene = createScene();
    const a = scene.add(rect({ x: 10 }));
    const b = scene.add(rect({ x: 20 }));
    scene.remove(a.id);
    expect(scene.get(a.id)).toBeUndefined();
    expect(scene.get(b.id)?.x).toBe(20);
    expect(scene.ordered()).toHaveLength(1);
  });

  // Platforms disagree on glyph advances. Storing the measurement is what makes
  // a scene reopen with the same layout on another machine.
  it('stores the measured size on text elements', () => {
    const scene = createScene();
    const t = scene.add(text()) as TextElement;
    expect(t.measuredWidth).toBe(42);
    expect(t.measuredHeight).toBe(17);
  });

  it('updates an element without replacing its identity', () => {
    const scene = createScene();
    const a = scene.add(rect());
    scene.update(a.id, { x: 99 });
    expect(scene.get(a.id)?.x).toBe(99);
    expect(scene.get(a.id)?.id).toBe(a.id);
  });

  // Serialisation is what undo compares and what Milestone 5 will persist, so
  // it has to be deterministic rather than dependent on insertion order.
  it('serialises deterministically', () => {
    const scene = createScene();
    const a = scene.add(rect());
    const b = scene.add(rect({ x: 5 }));
    const first = scene.serialise();
    scene.bringToFront(a.id);
    scene.sendToBack(a.id);
    expect(scene.serialise()).toBe(first);
    expect(b.id).toBeDefined();
  });
});
