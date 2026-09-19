import { describe, expect, it } from 'vitest';
import { createScene, type SceneElement } from './scene';
import { boundsOf, duplicate, flip, group, paste, ungroup, PASTE_OFFSET } from './edit';

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

// Mirroring a rotated element has to mirror the lean as well, or the flip is
// only half done, and the axis is the one the elements are drawn on.
describe('flipping a rotated element', () => {
  it('mirrors its angle', () => {
    const scene = createScene({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1, angle: 30 } as never,
        { id: 'b', type: 'rect', x: 80, y: 0, w: 20, h: 20, z: 2 } as never,
      ],
    });
    flip(scene, [scene.get('a')!, scene.get('b')!], 'horizontal');
    expect(scene.get('a')!.angle).toBe(330);
    expect(scene.get('b')!.angle).toBeUndefined();
  });

  it('mirrors about where the elements are drawn', () => {
    const scene = createScene({
      // Turned a quarter, this bar runs from x 40 to 60, not 0 to 100.
      elements: [{ id: 'a', type: 'rect', x: 0, y: 40, w: 100, h: 20, z: 1, angle: 90 } as never],
    });
    flip(scene, [scene.get('a')!], 'horizontal');
    // Mirrored about its own drawn bounds, the bar does not move.
    expect(scene.get('a')!.x).toBe(0);
  });
});

// A copy is a copy of the whole arrangement: its arrows attach to the copied
// shapes and its shapes join the copied frame, not the originals.
describe('copying keeps bindings and containment inside the copy', () => {
  const arranged = () => {
    const scene = createScene({
      elements: [
        { id: 'f', type: 'frame', x: 0, y: 0, w: 300, h: 200, z: 1 },
        { id: 'a', type: 'rect', x: 20, y: 20, w: 60, h: 60, z: 2, frame: 'f' },
        { id: 'b', type: 'rect', x: 200, y: 20, w: 60, h: 60, z: 3, frame: 'f' },
        { id: 'arrow', type: 'arrow', x: 80, y: 50, w: 120, h: 0, z: 4, points: [0, 0, 120, 0], startBinding: 'a', endBinding: 'b' },
      ] as never[],
    });
    return scene;
  };

  it('remaps a duplicated arrow onto the duplicated shapes', () => {
    const scene = arranged();
    const originals = ['a', 'b', 'arrow'].map((id) => scene.get(id)!);
    const copies = duplicate(scene, originals);
    const arrow = copies.find((e) => e.type === 'arrow') as Record<string, unknown>;
    const shapes = copies.filter((e) => e.type === 'rect');
    expect(shapes.map((s) => s.id)).toContain(arrow.startBinding);
    expect(shapes.map((s) => s.id)).toContain(arrow.endBinding);
  });

  it('remaps a duplicated child onto the duplicated frame', () => {
    const scene = arranged();
    const copies = duplicate(scene, [scene.get('f')!, scene.get('a')!]);
    const frame = copies.find((e) => e.type === 'frame')!;
    const child = copies.find((e) => e.type === 'rect') as Record<string, unknown>;
    expect(child.frame).toBe(frame.id);
  });

  // Copying only the arrow leaves it pointing at the shapes it was drawn
  // between: they are still there, and the copy sits on them.
  it('keeps a binding whose target was not copied', () => {
    const scene = arranged();
    const [copy] = duplicate(scene, [scene.get('arrow')!]) as unknown as Record<string, unknown>[];
    expect(copy.startBinding).toBe('a');
  });

  it('remaps through paste as well', () => {
    const scene = arranged();
    const pasted = paste(scene, [scene.get('a')!, scene.get('b')!, scene.get('arrow')!]);
    const arrow = pasted.find((e) => e.type === 'arrow') as Record<string, unknown>;
    expect(pasted.map((e) => e.id)).toContain(arrow.startBinding);
  });
});

// A duplicated group has to hold the copies, not the originals: otherwise
// selecting the copy selects and moves what it was copied from.
describe('copying a group', () => {
  it('points the copy children at the copies', () => {
    const scene = createScene({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
        { id: 'b', type: 'rect', x: 20, y: 0, w: 10, h: 10, z: 2 },
        { id: 'g', type: 'group', x: 0, y: 0, w: 30, h: 10, z: 3, children: ['a', 'b'] },
      ] as never[],
    });
    const [copy] = duplicate(scene, [scene.get('g')!]) as (SceneElement & { children: string[] })[];
    expect(copy.children).not.toContain('a');
    expect(copy.children).not.toContain('b');
    for (const child of copy.children) expect(scene.get(child)).toBeDefined();
  });
});

describe('pasting a group', () => {
  it('points the pasted children at the pasted copies', () => {
    const scene = createScene({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
        { id: 'b', type: 'rect', x: 20, y: 0, w: 10, h: 10, z: 2 },
        { id: 'g', type: 'group', x: 0, y: 0, w: 30, h: 10, z: 3, children: ['a', 'b'] },
      ] as never[],
    });
    const originals = ['a', 'b', 'g'].map((id) => scene.get(id)!);
    const pasted = paste(scene, originals) as (SceneElement & { children?: string[] })[];
    const group = pasted.find((e) => e.type === 'group')!;
    const copies = pasted.filter((e) => e.type === 'rect').map((e) => e.id);
    expect(group.children!.sort()).toEqual(copies.sort());
  });
});
