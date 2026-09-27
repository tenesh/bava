import { describe, expect, it } from 'vitest';
import type { SceneData, SceneElement } from './scene';
import { cornersOf } from './rotate';
import {
  boxPoints,
  movingPoints,
  resizedPoints,
  snapCorners,
  snapMove,
  snapPointer,
  snapReferences,
  type Guide,
} from './snapping';

// Snapping to objects, Excalidraw's rules with the box rule: every element
// offers its box's four corners, four side middles and centre.

const rect = (id: string, x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) =>
  ({ id, type: 'rect', x, y, w, h, z: 1, ...extra }) as unknown as SceneElement;
const scene = (...elements: SceneElement[]): SceneData => ({ elements });
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
const moving = (x: number, y: number, w = 50, h = 50) => {
  const b = box(x, y, w, h);
  return { points: boxPoints(b), box: b };
};
const sorted = (points: { x: number; y: number }[]) =>
  [...points].sort((a, b) => a.x - b.x || a.y - b.y);

describe('the reach', () => {
  const refs = snapReferences(scene(rect('a', 100, 0, 50, 50)), [], null);

  it('snaps an edge 8 away flush, at zoom 1', () => {
    const { points, box: b } = moving(108, 200);
    expect(snapMove(refs, points, b, 8).offset).toEqual({ x: -8, y: 0 });
  });

  it('does not snap one 9 away', () => {
    const { points, box: b } = moving(109, 200);
    expect(snapMove(refs, points, b, 8).offset).toEqual({ x: 0, y: 0 });
  });

  it('reaches 4 scene units at zoom 2', () => {
    expect(snapMove(refs, moving(104, 200).points, moving(104, 200).box, 4).offset.x).toBe(-4);
    expect(snapMove(refs, moving(105, 200).points, moving(105, 200).box, 4).offset.x).toBe(0);
  });
});

describe('choosing', () => {
  it('snaps each axis on its own', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 50, 50)), [], null);
    const { points, box: b } = moving(3, 55);
    expect(snapMove(refs, points, b, 8).offset).toEqual({ x: -3, y: -5 });
  });

  it('takes the nearer candidate on an axis', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 50, 50), rect('c', 5, 300, 50, 50)), [], null);
    const { points, box: b } = moving(3, 55);
    expect(snapMove(refs, points, b, 8).offset.x).toBe(2);
  });

  it('aligns centres', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 100, 100)), [], null);
    // A 20-wide box whose centre is 3 right of the other's centre (50).
    const { points, box: b } = moving(43, 300, 20, 20);
    expect(snapMove(refs, points, b, 8).offset.x).toBe(-3);
  });
});

describe('the box rule', () => {
  const nine = (x: number, y: number, w: number, h: number) => [
    { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
    { x: x + w / 2, y }, { x: x + w, y: y + h / 2 }, { x: x + w / 2, y: y + h }, { x, y: y + h / 2 },
    { x: x + w / 2, y: y + h / 2 },
  ];

  it.each(['rect', 'ellipse', 'cloud'])('a %s offers the nine points of its box', (type) => {
    const refs = snapReferences(scene(rect('a', 0, 0, 100, 40, { type })), [], null);
    expect(sorted(refs.points)).toEqual(sorted(nine(0, 0, 100, 40)));
  });

  it('a turned element offers its turned box points', () => {
    const turned = rect('a', 0, 0, 100, 20, { angle: 30 });
    const refs = snapReferences(scene(turned), [], null);
    const [tl, tr, br, bl] = cornersOf(turned);
    const mid = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const expected = [tl, tr, br, bl, mid(tl, tr), mid(tr, br), mid(br, bl), mid(bl, tl), { x: 50, y: 10 }];
    const round = (p: { x: number; y: number }) => ({ x: Math.round(p.x * 1e6) / 1e6, y: Math.round(p.y * 1e6) / 1e6 });
    expect(sorted(refs.points.map(round))).toEqual(sorted(expected.map(round)));
  });

  it('marks side middles on a guide', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 50, 50)), [], null);
    const { points, box: b } = moving(100, 2);
    const { guides } = snapMove(refs, points, b, 8);
    const top = guides.find((g): g is Extract<Guide, { kind: 'points' }> => g.kind === 'points' && g.points.every((p) => p.y === 0));
    expect(top?.points).toContainEqual({ x: 25, y: 0 });
    expect(top?.points).toContainEqual({ x: 125, y: 0 });
  });

  it('a moving selection of one turned element offers its turned points', () => {
    const turned = rect('a', 0, 0, 100, 20, { angle: 30 });
    expect(movingPoints([turned])).toHaveLength(9);
    expect(movingPoints([turned])).toContainEqual(cornersOf(turned)[0]);
  });

  it('a moving selection of several offers the box around them', () => {
    const points = movingPoints([rect('a', 0, 0, 10, 10), rect('b', 90, 90, 10, 10)]);
    expect(sorted(points)).toEqual(sorted(boxPoints(box(0, 0, 100, 100))));
  });
});

describe('what is a target', () => {
  it('takes a group as one box, not its children', () => {
    const data = scene(
      rect('a', 0, 0, 10, 10),
      rect('b', 90, 90, 10, 10),
      { id: 'g', type: 'group', x: 0, y: 0, w: 100, h: 100, z: 3, children: ['a', 'b'] } as unknown as SceneElement,
    );
    const refs = snapReferences(data, [], null);
    expect(sorted(refs.points)).toEqual(sorted(boxPoints(box(0, 0, 100, 100))));
  });

  it('never takes what is moving, a moved frame\'s contents or the arrows attached to them', () => {
    const data = scene(
      { id: 'f', type: 'frame', x: 0, y: 0, w: 200, h: 200, z: 1 } as unknown as SceneElement,
      rect('in', 20, 20, 40, 40, { frame: 'f' }),
      rect('other', 300, 0, 40, 40),
      { id: 'arrow', type: 'arrow', x: 60, y: 40, w: 240, h: 0, z: 4, points: [0, 0, 240, 0], startBinding: 'in', endBinding: 'other' } as unknown as SceneElement,
    );
    const refs = snapReferences(data, ['f'], null);
    expect(sorted(refs.points)).toEqual(sorted(boxPoints(box(300, 0, 40, 40))));
  });

  it('leaves out what is off screen', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 10, 10), rect('b', 500, 0, 10, 10)), [], box(-50, -50, 200, 200));
    expect(sorted(refs.points)).toEqual(sorted(boxPoints(box(0, 0, 10, 10))));
  });
});

describe('equal spacing', () => {
  it('repeats a gap past the last element', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 40, 40), rect('b', 80, 0, 40, 40)), [], null);
    const { points, box: b } = moving(163, 0, 40, 40);
    const { offset, guides } = snapMove(refs, points, b, 8);
    expect(offset.x).toBe(-3);
    const gaps = guides.filter((g) => g.kind === 'gap');
    expect(gaps).toHaveLength(2);
    expect(gaps.map((g) => [g.from.x, g.to.x]).sort((p, q) => p[0] - q[0])).toEqual([[40, 80], [120, 160]]);
  });

  it('repeats a gap before the first element', () => {
    const refs = snapReferences(scene(rect('a', 100, 0, 40, 40), rect('b', 180, 0, 40, 40)), [], null);
    const { points, box: b } = moving(22, 0, 40, 40);
    expect(snapMove(refs, points, b, 8).offset.x).toBe(-2);
  });

  it('centres in a wider gap', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 40, 40), rect('b', 200, 0, 40, 40)), [], null);
    const { points, box: b } = moving(97, 0, 40, 40);
    expect(snapMove(refs, points, b, 8).offset.x).toBe(3);
  });

  // Only neighbours make a gap, so a large
  // board stays smooth. A and C have B between them: no A-to-C gap.
  it('counts only gaps between neighbours', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 40, 40), rect('b', 60, 0, 40, 40), rect('c', 130, 0, 40, 40)), [], null);
    expect(refs.gaps.map((g) => [g.from, g.to])).toEqual([[40, 60], [100, 130]]);
  });

  it('repeats the gap beside the last of a row', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 40, 40), rect('b', 60, 0, 40, 40), rect('c', 130, 0, 40, 40)), [], null);
    // B to C is 30: D belongs at 200, dragged to 204.
    const { points, box: b } = moving(204, 0, 40, 40);
    expect(snapMove(refs, points, b, 8).offset.x).toBe(-4);
  });

  it('is blocked by a shape reaching into the gap from outside it', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 40, 40), rect('b', 100, 0, 40, 40), rect('long', 20, 10, 60, 10)), [], null);
    expect(refs.gaps.some((g) => g.axis === 'x' && g.from === 40 && g.to === 100)).toBe(false);
  });

  // A frame or a larger shape behind a row must not block the gaps in it.
  it.each([
    ['frame', { id: 'f', type: 'frame', x: 0, y: 0, w: 1000, h: 1000, z: 0 }],
    ['background', { id: 'bg', type: 'rect', x: 0, y: 0, w: 1000, h: 1000, z: 0 }],
  ])('counts gaps in a row on a %s', (_name, behind) => {
    const refs = snapReferences(scene(behind as unknown as SceneElement, rect('a', 100, 100, 40, 40), rect('b', 200, 100, 40, 40)), [], null);
    expect(refs.gaps.some((g) => g.axis === 'x' && g.from === 140 && g.to === 200)).toBe(true);
    const { points, box: b } = moving(303, 100, 40, 40);
    expect(snapMove(refs, points, b, 8).offset.x).toBe(-3);
  });

  // Two shapes starting at the same place are both neighbours,
  // whichever the scene lists first.
  it('keeps both neighbours that start at the same place', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 100, 100), rect('b', 200, 0, 40, 100), rect('c', 200, 40, 100, 20)), [], null);
    expect(refs.gaps.filter((g) => g.axis === 'x' && g.from === 100).map((g) => g.to)).toEqual([200, 200]);
  });

  it('only counts a gap beside the moving box', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 40, 40), rect('b', 80, 0, 40, 40)), [], null);
    const { points, box: b } = moving(163, 300, 40, 40);
    expect(snapMove(refs, points, b, 8).offset.x).toBe(0);
  });
});

describe('guides', () => {
  it('show every exact alignment after the snap and nothing merely near', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 50, 50), rect('b', 2, 200, 50, 50)), [], null);
    const { points, box: b } = moving(5, 400);
    const { offset, guides } = snapMove(refs, points, b, 8);
    expect(offset.x).toBe(-3);
    const drawn = guides.flatMap((g) => (g.kind === 'points' ? g.points : []));
    expect(drawn).toContainEqual({ x: 2, y: 200 });
    expect(drawn.some((p) => p.x === 0)).toBe(false);
  });

  it('are empty when nothing lines up', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 50, 50)), [], null);
    const { points, box: b } = moving(300, 300);
    expect(snapMove(refs, points, b, 8).guides).toEqual([]);
  });
});

describe('resizing and drawing', () => {
  it('moves only the right corners with the right handle, on x alone', () => {
    const { points, x, y } = resizedPoints(box(0, 0, 50, 50), 'right');
    expect(sorted(points)).toEqual(sorted([{ x: 50, y: 0 }, { x: 50, y: 50 }]));
    expect({ x, y }).toEqual({ x: true, y: false });
  });

  it('moves one corner with a corner handle, on both axes', () => {
    const { points, x, y } = resizedPoints(box(0, 0, 50, 50), 'top-left');
    expect(points).toEqual([{ x: 0, y: 0 }]);
    expect({ x, y }).toEqual({ x: true, y: true });
  });

  it('snaps corners to points, never to spacing', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 40, 40), rect('b', 80, 0, 40, 40)), [], null);
    // A corner 3 short of where equal spacing would put it, and nowhere near a point.
    expect(snapCorners(refs, [{ x: 157, y: 300 }], 8).offset).toEqual({ x: 0, y: 0 });
    expect(snapCorners(refs, [{ x: 117, y: 300 }], 8).offset).toEqual({ x: 3, y: 0 });
  });

  it('snaps the pointer to the nearest point on each axis, with a guide from it', () => {
    const refs = snapReferences(scene(rect('a', 0, 0, 50, 50)), [], null);
    const { point, guides } = snapPointer(refs, { x: 53, y: 200 }, 8);
    expect(point).toEqual({ x: 50, y: 200 });
    expect(guides).toContainEqual({ kind: 'pointer', from: { x: 50, y: 50 }, to: { x: 50, y: 200 } });
  });
});
