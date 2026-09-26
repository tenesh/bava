/**
 * Routing an elbow arrow: right angles only, leaving each attached shape from
 * the side its end is on, going around both shapes.
 *
 * Excalidraw's method (`.claude/work/specs/excalidraw-elbow-routing.md`,
 * `element/src/elbowArrow.ts`), in Bava's own code: each shape is grown by a
 * margin and treated as an obstacle; each end steps out of its grown shape in
 * its heading (the "dongle"); the edges of the grown shapes, the line midway
 * between them and a border around everything make a grid; and a shortest
 * path over that grid, with each bend costing more than any length could,
 * gives the fewest bends first and the shortest route second.
 *
 * Pure: points in, points out. The caller (`binding.ts`, `reroute`) decides
 * where the ends are and which way they face, and stores the route.
 */
import type { Point } from './binding';

export type Heading = 'up' | 'right' | 'down' | 'left';

/** An upright box in scene space. */
export type Box = { x: number; y: number; w: number; h: number };

/**
 * How far a route keeps from the shapes it joins, in scene units. The token
 * `--size-elbow-margin` is the source; this is its value at the default theme,
 * for a pure function that takes no reader, as `BINDING_GAP` is. Excalidraw
 * pads by up to 40 (`BASE_PADDING`) on the far sides and less on the heading
 * side; half of it on every side keeps the route close and clear.
 */
export const ELBOW_MARGIN = 20;

const VECTOR: Record<Heading, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const OPPOSITE: Record<Heading, Heading> = { up: 'down', right: 'left', down: 'up', left: 'right' };

/** The heading of a vector, as Excalidraw's `vectorToHeading`. */
export function headingOf(dx: number, dy: number): Heading {
  if (dx > Math.abs(dy)) return 'right';
  if (dx <= -Math.abs(dy) && dx !== 0) return 'left';
  if (dy > Math.abs(dx)) return 'down';
  return dy === 0 && dx === 0 ? 'right' : 'up';
}

/**
 * The side of a shape an anchor is on, facing outward: the anchor's offset
 * from the centre, measured against the box's own proportions, so a spot on a
 * wide box's top edge is on its top, not its side. Excalidraw's triangle test
 * (`heading.ts:231-281`) comes to the same.
 */
export function sideOf(anchor: [number, number]): Heading | null {
  const dx = anchor[0] - 0.5;
  const dy = anchor[1] - 0.5;
  if (dx === 0 && dy === 0) return null;
  return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}

export type ElbowEnd = {
  /** Where the arrow ends: on the shape's outline, a gap clear, or free. */
  point: Point;
  /** The way the route leaves this end, outward from its shape. */
  heading: Heading;
  /** The attached shape's upright bounds, or none for a free end. */
  box?: Box;
};

/**
 * The route from `start` to `end`, as flat x,y pairs in scene space, both
 * ends included; or null when no route avoids the shapes, for the caller to
 * fall back on a plain Z.
 */
export function routeElbow(start: ElbowEnd, end: ElbowEnd, options: { gap?: number } = {}): number[] | null {
  const gap = options.gap ?? 0;
  let margin = ELBOW_MARGIN;
  let startBox = start.box;
  let endBox = end.box;
  if (startBox && endBox) {
    const apart = Math.max(
      startBox.x - (endBox.x + endBox.w),
      endBox.x - (startBox.x + startBox.w),
      startBox.y - (endBox.y + endBox.h),
      endBox.y - (startBox.y + startBox.h),
    );
    if (apart < gap * 2 + 1) {
      // Overlapping, touching, or one shape at both ends: no room between
      // them, so the route goes round the two as one.
      const union = unionOf(startBox, endBox);
      startBox = union;
      endBox = union;
    } else {
      // Two shapes closer than twice the margin share the gap between them,
      // less the space each end already stands off its shape.
      margin = Math.min(margin, (apart - gap * 2) / 2);
    }
  }
  const grown = (box?: Box) =>
    box ? { x: box.x - margin, y: box.y - margin, w: box.w + margin * 2, h: box.h + margin * 2 } : undefined;
  const obstacles = unique([grown(startBox), grown(endBox)].filter((b): b is Box => Boolean(b)));

  const startDongle = dongle(start, grown(startBox));
  const endDongle = dongle(end, grown(endBox));

  // The grid: every obstacle edge, both dongles, the midline between the
  // dongles, and a border around everything a route could need.
  const xs = new Set<number>([startDongle.x, endDongle.x, (startDongle.x + endDongle.x) / 2]);
  const ys = new Set<number>([startDongle.y, endDongle.y, (startDongle.y + endDongle.y) / 2]);
  for (const box of obstacles) {
    xs.add(box.x).add(box.x + box.w);
    ys.add(box.y).add(box.y + box.h);
  }
  const allX = [...xs];
  const allY = [...ys];
  const border = ELBOW_MARGIN;
  xs.add(Math.min(...allX) - border).add(Math.max(...allX) + border);
  ys.add(Math.min(...allY) - border).add(Math.max(...allY) + border);
  const gridX = [...xs].sort((a, b) => a - b);
  const gridY = [...ys].sort((a, b) => a - b);

  const path = search(gridX, gridY, obstacles, startDongle, start.heading, endDongle, end.heading);
  if (!path) return null;
  return simplify([start.point, ...path, end.point]);
}

function unionOf(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function unique(boxes: Box[]): Box[] {
  return boxes.filter((box, i) => boxes.findIndex((other) => other.x === box.x && other.y === box.y && other.w === box.w && other.h === box.h) === i);
}

/** An end stepped out of its grown shape along its heading; a free end stays put. */
function dongle(end: ElbowEnd, grown?: Box): Point {
  if (!grown) return end.point;
  switch (end.heading) {
    case 'up':
      return { x: end.point.x, y: Math.min(end.point.y, grown.y) };
    case 'down':
      return { x: end.point.x, y: Math.max(end.point.y, grown.y + grown.h) };
    case 'left':
      return { x: Math.min(end.point.x, grown.x), y: end.point.y };
    case 'right':
      return { x: Math.max(end.point.x, grown.x + grown.w), y: end.point.y };
  }
}

type State = { i: number; j: number; heading: Heading };

/**
 * The cheapest grid path from one dongle to the other: each step costs its
 * length, and a change of direction costs more than any path on the grid is
 * long, so the fewest bends win first and the shortest route second.
 * A route never reverses, never runs inside a grown shape, and never reaches
 * the end moving outward from it (which would mean coming from inside).
 */
function search(
  gridX: number[],
  gridY: number[],
  obstacles: Box[],
  from: Point,
  fromHeading: Heading,
  to: Point,
  toHeading: Heading,
): Point[] | null {
  const startI = gridX.indexOf(from.x);
  const startJ = gridY.indexOf(from.y);
  const endI = gridX.indexOf(to.x);
  const endJ = gridY.indexOf(to.y);
  // Four times the grid's whole span: a leg can be no longer than the span, so
  // a bend costs more than the detours that matter here. Excalidraw cubes
  // the dongle distance instead, which loses float precision on a large
  // canvas and is too cheap when the ends are close but the shapes big.
  const span = gridX[gridX.length - 1] - gridX[0] + (gridY[gridY.length - 1] - gridY[0]);
  const bend = Math.max(1, span) * 4;
  // The last leg runs from the end's dongle into the shape: arriving already
  // travelling that way saves a bend.
  const arrival = OPPOSITE[toHeading];

  const key = (s: State) => `${s.i},${s.j},${s.heading}`;
  const cost = new Map<string, number>();
  const parent = new Map<string, State | null>();
  const open = new Heap<{ state: State; cost: number }>((a, b) => a.cost - b.cost);
  const first: State = { i: startI, j: startJ, heading: fromHeading };
  cost.set(key(first), 0);
  parent.set(key(first), null);
  open.push({ state: first, cost: 0 });

  let best: { state: State; cost: number } | null = null;
  while (open.size > 0) {
    const current = open.pop()!;
    const here = key(current.state);
    if (current.cost > (cost.get(here) ?? Infinity)) continue;
    if (best && current.cost >= best.cost) break;
    if (current.state.i === endI && current.state.j === endJ) {
      const total = current.cost + (current.state.heading === arrival ? 0 : bend);
      if (!best || total < best.cost) best = { state: current.state, cost: total };
      continue;
    }
    for (const heading of ['up', 'right', 'down', 'left'] as Heading[]) {
      if (heading === OPPOSITE[current.state.heading]) continue;
      const i = current.state.i + VECTOR[heading].x;
      const j = current.state.j + VECTOR[heading].y;
      if (i < 0 || j < 0 || i >= gridX.length || j >= gridY.length) continue;
      const a = { x: gridX[current.state.i], y: gridY[current.state.j] };
      const b = { x: gridX[i], y: gridY[j] };
      const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (obstacles.some((box) => strictlyInside(middle, box))) continue;
      // Reaching the end moving outward from it means coming from inside.
      if (i === endI && j === endJ && heading === toHeading) continue;
      const next: State = { i, j, heading };
      const nextCost = current.cost + Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + (heading === current.state.heading ? 0 : bend);
      if (nextCost < (cost.get(key(next)) ?? Infinity)) {
        cost.set(key(next), nextCost);
        parent.set(key(next), current.state);
        open.push({ state: next, cost: nextCost });
      }
    }
  }
  if (!best) return null;

  const path: Point[] = [];
  let at: State | null = best.state;
  while (at) {
    path.unshift({ x: gridX[at.i], y: gridY[at.j] });
    at = parent.get(key(at)) ?? null;
  }
  return path;
}

function strictlyInside(point: Point, box: Box): boolean {
  return point.x > box.x && point.x < box.x + box.w && point.y > box.y && point.y < box.y + box.h;
}

/** Points with duplicates (within a unit) and straight-through corners dropped. */
function simplify(points: Point[]): number[] {
  const kept: Point[] = [];
  for (const point of points) {
    const last = kept.at(-1);
    if (last && Math.abs(last.x - point.x) < 1 && Math.abs(last.y - point.y) < 1) continue;
    kept.push(point);
  }
  const out: Point[] = [];
  for (let i = 0; i < kept.length; i += 1) {
    const before = out.at(-1);
    const after = kept[i + 1];
    if (before && after) {
      const sameX = before.x === kept[i].x && kept[i].x === after.x;
      const sameY = before.y === kept[i].y && kept[i].y === after.y;
      if (sameX || sameY) continue;
    }
    out.push(kept[i]);
  }
  return out.flatMap((p) => [p.x, p.y]);
}

/** A binary min-heap: the search's open set, cheapest first. */
class Heap<T> {
  #items: T[] = [];
  #before: (a: T, b: T) => number;

  constructor(before: (a: T, b: T) => number) {
    this.#before = before;
  }

  get size(): number {
    return this.#items.length;
  }

  push(item: T): void {
    const items = this.#items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.#before(items[i], items[parent]) >= 0) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const items = this.#items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0 && last !== undefined) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let least = i;
        if (left < items.length && this.#before(items[left], items[least]) < 0) least = left;
        if (right < items.length && this.#before(items[right], items[least]) < 0) least = right;
        if (least === i) break;
        [items[i], items[least]] = [items[least], items[i]];
        i = least;
      }
    }
    return top;
  }
}
