import { describe, expect, it } from 'vitest';
import { carriedWith, frameAt, framedBy, membershipFor, movedIds } from './containment';
import type { SceneData, SceneElement } from './scene';

const scene = (): SceneData => ({
  elements: [
    { id: 'f', type: 'frame', x: 0, y: 0, w: 200, h: 200, z: 1 },
    { id: 'inside', type: 'rect', x: 20, y: 20, w: 40, h: 40, z: 2, frame: 'f' },
    { id: 'outside', type: 'rect', x: 400, y: 0, w: 40, h: 40, z: 3 },
    { id: 'edge', type: 'rect', x: 180, y: 20, w: 40, h: 40, z: 4 },
  ] as SceneElement[],
});

const byId = (data: SceneData, id: string) => data.elements.find((e) => e.id === id)!;

describe('which frame holds an element', () => {
  it('is the frame that covers it entirely', () => {
    expect(frameAt(scene(), byId(scene(), 'inside'))?.id).toBe('f');
  });

  // Half in is not in: dragging a frame would otherwise carry off a shape
  // that merely overlaps its edge.
  it('is nothing when the element only overlaps the edge', () => {
    expect(frameAt(scene(), byId(scene(), 'edge'))).toBeUndefined();
    expect(frameAt(scene(), byId(scene(), 'outside'))).toBeUndefined();
  });

  it('is never the frame itself, and never another frame', () => {
    const data = scene();
    expect(frameAt(data, byId(data, 'f'))).toBeUndefined();
  });

  it('is the innermost frame when frames overlap', () => {
    const data = scene();
    data.elements.push({ id: 'small', type: 'frame', x: 0, y: 0, w: 100, h: 100, z: 5 } as SceneElement);
    expect(frameAt(data, byId(data, 'inside'))?.id).toBe('small');
  });
});

describe('what a frame owns', () => {
  it('is every element that records it', () => {
    expect(framedBy(scene(), 'f').map((e) => e.id)).toEqual(['inside']);
    expect(framedBy(scene(), 'nobody')).toEqual([]);
  });
});

describe('membership after a move', () => {
  it('adds an element dropped inside', () => {
    const data = scene();
    const moved = { ...byId(data, 'outside'), x: 100, y: 100 } as SceneElement;
    data.elements[2] = moved;
    expect(membershipFor(data, ['outside'])).toEqual(new Map([['outside', 'f']]));
  });

  it('removes one dragged out', () => {
    const data = scene();
    data.elements[1] = { ...byId(data, 'inside'), x: 400, y: 400 } as SceneElement;
    expect(membershipFor(data, ['inside'])).toEqual(new Map([['inside', undefined]]));
  });

  it('says nothing about an element whose membership has not changed', () => {
    expect(membershipFor(scene(), ['inside'])).toEqual(new Map());
    expect(membershipFor(scene(), ['outside'])).toEqual(new Map());
  });

  // Moving a frame must not capture whatever it happens to pass over, or a
  // frame dragged across the canvas would hoover up the scene.
  it('leaves other elements alone when the frame itself moved', () => {
    const data = scene();
    data.elements[0] = { ...byId(data, 'f'), x: 380, y: 0 } as SceneElement;
    expect(membershipFor(data, ['f'])).toEqual(new Map());
  });
});

// Which elements a change actually moved, so membership is recomputed for
// them and not for whatever a moving frame happened to pass over.
describe('what a change moved', () => {
  const before = scene();

  it('names the elements whose geometry changed', () => {
    const after = scene();
    after.elements[1] = { ...after.elements[1], x: 300 } as SceneElement;
    expect(movedIds(before, after)).toEqual(['inside']);
  });

  it('counts a resize and a rotation as a move', () => {
    const resized = scene();
    resized.elements[1] = { ...resized.elements[1], w: 400 } as SceneElement;
    expect(movedIds(before, resized)).toEqual(['inside']);

    const turned = scene();
    turned.elements[1] = { ...turned.elements[1], angle: 30 } as SceneElement;
    expect(movedIds(before, turned)).toEqual(['inside']);
  });

  it('names a new element, which has to find its frame', () => {
    const added = scene();
    added.elements.push({ id: 'fresh', type: 'rect', x: 10, y: 10, w: 10, h: 10, z: 9 } as SceneElement);
    expect(movedIds(before, added)).toEqual(['fresh']);
  });

  it('names nothing when only a style changed', () => {
    const restyled = scene();
    restyled.elements[1] = { ...restyled.elements[1], fill: 'blue' } as SceneElement;
    expect(movedIds(before, restyled)).toEqual([]);
  });
});

// One expansion for every way of moving a selection, so the keyboard and the
// mouse agree about what a frame or a group carries.
describe('what moves with a selection', () => {
  it('carries a frame contents and a group children', () => {
    const data = scene();
    data.elements.push(
      { id: 'g', type: 'group', x: 0, y: 0, w: 10, h: 10, z: 6, children: ['outside'] } as SceneElement,
    );
    expect(carriedWith(data, ['f']).map((e) => e.id).sort()).toEqual(['f', 'inside']);
    expect(carriedWith(data, ['g']).map((e) => e.id).sort()).toEqual(['g', 'outside']);
  });

  it('carries what a frame holds even when the child is named too', () => {
    expect(carriedWith(scene(), ['f', 'inside']).map((e) => e.id).sort()).toEqual(['f', 'inside']);
  });

  it('is just the selection when nothing holds anything', () => {
    expect(carriedWith(scene(), ['edge']).map((e) => e.id)).toEqual(['edge']);
  });
});

// A frame inside a frame: the outer one has to carry the whole tree, not the
// first level of it. A converted D2 diagram nests as deeply as its source.
describe('frames inside frames', () => {
  const nested = (): SceneData => ({
    elements: [
      { id: 'outer', type: 'frame', x: 0, y: 0, w: 300, h: 300, z: 1 },
      { id: 'inner', type: 'frame', x: 20, y: 20, w: 200, h: 200, z: 2, frame: 'outer' },
      { id: 'leaf', type: 'rect', x: 40, y: 40, w: 40, h: 40, z: 3, frame: 'inner' },
    ] as SceneElement[],
  });

  it('carries every level, not only the first', () => {
    expect(carriedWith(nested(), ['outer']).map((e) => e.id).sort()).toEqual(['inner', 'leaf', 'outer']);
  });

  it('carries the inner frame contents when only it is moved', () => {
    expect(carriedWith(nested(), ['inner']).map((e) => e.id).sort()).toEqual(['inner', 'leaf']);
  });

  it('does not loop when a frame somehow records itself', () => {
    const cycle = nested();
    cycle.elements[0] = { ...cycle.elements[0], frame: 'inner' } as SceneElement;
    expect(carriedWith(cycle, ['outer']).map((e) => e.id).sort()).toEqual(['inner', 'leaf', 'outer']);
  });
});
