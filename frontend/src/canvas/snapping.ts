/**
 * Snapping to objects (Milestone 7): Excalidraw's rules
 * (`.claude/work/specs/excalidraw-object-snapping.md`), with Bava's box rule.
 *
 * Pure: scene data in, offsets and guides out, in scene units. The pointer
 * gathers the targets once per drag (`snapReferences`) and asks for an offset
 * on every move; the stage draws the guides.
 *
 * - **The box rule.** Every element, whatever it draws, offers the nine
 *   points of its box: four corners, four side middles and the centre,
 *   turned with it. A group offers the box around its children.
 * - **Per axis.** X and Y are decided apart. On each, the nearest candidate
 *   within the threshold wins, an equal one joining it; point snaps are
 *   tried first, then equal spacing on the same distance.
 * - **Guides show exact alignments only**, from a second pass at the
 *   snapped place with no reach at all.
 */
import type { Point } from './binding';
import { carriedWith } from './containment';
import { drawnBoundsOf } from './edit';
import type { Handle } from './resize';
import { angleOfElement, centreOf, rotatePoint, rotatedBounds } from './rotate';
import type { ElementId, SceneData, SceneElement } from './scene';
import type { Box } from './selection';

type Axis = 'x' | 'y';

/**
 * The space between two targets on one axis: `from` is where the first ends
 * and `to` where the second starts; `overlap` is the range they share on the
 * other axis, which a moving box must reach into for the gap to count.
 */
export type Gap = {
  axis: Axis;
  start: Box;
  end: Box;
  from: number;
  to: number;
  length: number;
  overlap: [number, number];
};

/**
 * What a drag snaps to. `points` are the targets; `lines` the same points by
 * their exact x and y, with each axis's values sorted, so a move looks up the
 * nearest alignment instead of comparing every point (Milestone 7, Task 8).
 */
export type References = {
  points: Point[];
  gaps: Gap[];
  lines: Record<Axis, { values: number[]; at: Map<number, Point[]> }>;
};

function linesOf(points: Point[]): References['lines'] {
  const index = (axis: Axis) => {
    const at = new Map<number, Point[]>();
    for (const point of points) {
      const line = at.get(point[axis]);
      if (line) line.push(point);
      else at.set(point[axis], [point]);
    }
    return { values: [...at.keys()].sort((a, b) => a - b), at };
  };
  return { x: index('x'), y: index('y') };
}

/** The values either side of `value` in a sorted list: the only ones that can be nearest. */
function besideIn(values: number[], value: number): number[] {
  const at = besideIndex(values, value);
  return [values[at - 1], values[at]].filter((found) => found !== undefined);
}

/**
 * What the stage draws: a line through points that line up (with a cross at
 * each), a spacing mark along `axis` from `from` to `to`, or, while a tool
 * hovers, a line from the point the pointer snapped to.
 */
export type Guide =
  | { kind: 'points'; points: Point[] }
  | { kind: 'gap'; axis: Axis; from: Point; to: Point }
  | { kind: 'pointer'; from: Point; to: Point };

export type Snap = { offset: Point; guides: Guide[] };

/**
 * Points are compared at six decimals, as Excalidraw's are: a box moved by
 * floating-point sums must still line up exactly with one it was snapped to.
 */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

const rounded = (point: Point): Point => ({ x: round(point.x), y: round(point.y) });

/** A box's nine points, turned `angle` degrees about its centre: corners, side middles, centre. */
export function boxPoints(box: Box, angle = 0): Point[] {
  const { x, y, w, h } = box;
  const points = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
    { x: x + w / 2, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w / 2, y: y + h },
    { x, y: y + h / 2 },
    { x: x + w / 2, y: y + h / 2 },
  ];
  if (angle === 0) return points;
  const centre = centreOf(box);
  return points.map((point) => rotatePoint(point, centre, angle));
}

/**
 * What a moving selection offers: one element's own turned points, or the
 * nine points of the upright box around several.
 */
export function movingPoints(elements: SceneElement[]): Point[] {
  if (elements.length === 1) return boxPoints(elements[0], angleOfElement(elements[0]));
  return boxPoints(drawnBoundsOf(elements));
}

/**
 * The corners a resize handle moves, from the box it is resizing, and the
 * axes it may snap on: an edge handle moves the two corners on its edge along
 * one axis, a corner handle one corner along both.
 */
export function resizedPoints(box: Box, handle: Handle): { points: Point[]; x: boolean; y: boolean } {
  const xs = handle.includes('left') ? [box.x] : handle.includes('right') ? [box.x + box.w] : [box.x, box.x + box.w];
  const ys = handle.startsWith('top') ? [box.y] : handle.startsWith('bottom') ? [box.y + box.h] : [box.y, box.y + box.h];
  return {
    points: xs.flatMap((x) => ys.map((y) => ({ x, y }))),
    x: handle.includes('left') || handle.includes('right'),
    y: handle.startsWith('top') || handle.startsWith('bottom'),
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

/**
 * The points and gaps to snap to: elements in `visible` (the viewport, in
 * scene units; null for everywhere) that are not moving. What a move of
 * `moving` carries (a group's children, a frame's contents) and the arrows
 * attached to any of it are left out, since they go with it. A group counts
 * once, as the box around its children. `gaps` false skips equal spacing,
 * which only a drag uses.
 */
export function snapReferences(scene: SceneData, moving: ElementId[], visible: Box | null, gaps = true): References {
  const carried = new Set(carriedWith(scene, moving).map((element) => element.id));
  for (const element of scene.elements) {
    const record = element as { startBinding?: string; endBinding?: string };
    if (element.type !== 'arrow') continue;
    if ((record.startBinding && carried.has(record.startBinding)) || (record.endBinding && carried.has(record.endBinding))) {
      carried.add(element.id);
    }
  }

  const byId = new Map(scene.elements.map((element) => [element.id, element]));
  const inGroup = new Set<ElementId>();
  for (const element of scene.elements) if (element.type === 'group') element.children.forEach((id) => inGroup.add(id));

  // What a group covers: its drawn children, all the way down, bar what moves.
  const drawnIn = (group: SceneElement): SceneElement[] => {
    const found: SceneElement[] = [];
    const seen = new Set<ElementId>();
    const visit = (element: SceneElement | undefined) => {
      if (!element || seen.has(element.id)) return;
      seen.add(element.id);
      if (element.type === 'group') element.children.forEach((id) => visit(byId.get(id)));
      else if (!carried.has(element.id)) found.push(element);
    };
    visit(group);
    return found;
  };

  const points: Point[] = [];
  const bounds: Box[] = [];
  for (const element of scene.elements) {
    if (inGroup.has(element.id) || carried.has(element.id)) continue;
    let box: Box;
    let unit: Point[];
    if (element.type === 'group') {
      const children = drawnIn(element);
      if (children.length === 0) continue;
      box = drawnBoundsOf(children);
      unit = boxPoints(box);
    } else {
      box = rotatedBounds(element);
      unit = boxPoints(element, angleOfElement(element));
    }
    if (visible && !overlaps(box, visible)) continue;
    points.push(...unit.map(rounded));
    bounds.push(box);
  }
  return { points, gaps: gaps ? gapsBetween(bounds) : [], lines: linesOf(points) };
}

/**
 * The gaps between neighbours: two boxes with space between them on an axis,
 * a range shared on the other, and nothing else reaching into that space
 * within that range. Excalidraw counts every pair; neighbours only is the
 * user's choice (2026-09-27), since every pair is 90,000 gaps on a board of
 * 2,000 shapes zoomed out, and a gap across other shapes is one nobody sees.
 */
function gapsBetween(boxes: Box[]): Gap[] {
  const gaps: Gap[] = [];
  for (const axis of ['x', 'y'] as const) {
    const [pos, size, across, span] = axis === 'x' ? (['x', 'w', 'y', 'h'] as const) : (['y', 'h', 'x', 'w'] as const);
    const sorted = [...boxes].sort((a, b) => a[pos] - b[pos]);
    // Plain number arrays in that order: one long shape makes every search
    // start from the beginning, and this is the loop that pays for it.
    const starts = Float64Array.from(sorted, (box) => box[pos]);
    const ends = Float64Array.from(sorted, (box) => box[pos] + box[size]);
    const lows = Float64Array.from(sorted, (box) => box[across]);
    const highs = Float64Array.from(sorted, (box) => box[across] + box[span]);
    const longest = Math.max(0, ...boxes.map((box) => box[size]));
    for (const start of boxes) {
      const from = start[pos] + start[size];
      const low = start[across];
      const high = start[across] + start[span];
      // What already stands beside the start past its far edge, as merged
      // ranges on the other axis, clipped to the start's side.
      const covered = createCover();
      // Boxes starting at one place are all measured against what stood
      // before that place, then added together: neither blocks the other.
      let group: { to: number; range: [number, number] }[] = [];
      const settle = () => {
        for (const { range } of group) covered.add(range);
        group = [];
      };
      // Nothing that starts further back than the longest box can reach past `from`.
      for (let i = besideIndex(starts, from - longest); i < sorted.length; i += 1) {
        if (ends[i] <= from || lows[i] > high || highs[i] < low) continue;
        const other = sorted[i];
        if (other === start) continue;
        // A box around the start (a frame, a shape behind a row) is not
        // between it and anything.
        if (starts[i] <= start[pos] && lows[i] <= low && highs[i] >= high) continue;
        const range: [number, number] = [Math.max(low, lows[i]), Math.min(high, highs[i])];
        const to = starts[i];
        if (group.length > 0 && group[0].to !== to) {
          settle();
          // Once the start's whole side is covered, nothing further is a neighbour.
          if (covered.spans(low, high)) break;
        }
        if (from < to && !covered.meets(range)) {
          gaps.push({ axis, start, end: other, from, to, length: to - from, overlap: range });
        }
        group.push({ to, range });
      }
    }
  }
  return gaps;
}

/** The first index whose value is at least `value`, in a sorted list. */
function besideIndex(values: ArrayLike<number>, value: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (values[middle] < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * Ranges on a line, merged as they are added and kept in order, so whether
 * a range meets them, or they span a stretch, is a search rather than a scan.
 */
function createCover() {
  const merged: [number, number][] = [];
  /** The first merged range ending after `value`. */
  const after = (value: number) => {
    let low = 0;
    let high = merged.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (merged[middle][1] <= value) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  return {
    add([a, b]: [number, number]): void {
      let first = after(a);
      if (first > 0 && merged[first - 1][1] >= a) first -= 1;
      let last = first;
      let from = a;
      let to = b;
      while (last < merged.length && merged[last][0] <= to) {
        from = Math.min(from, merged[last][0]);
        to = Math.max(to, merged[last][1]);
        last += 1;
      }
      merged.splice(first, last - first, [from, to]);
    },
    /** Whether a range overlaps what is covered by more than a touch. */
    meets([a, b]: [number, number]): boolean {
      const found = merged[after(a)];
      return found !== undefined && found[0] < b;
    },
    /** Whether `low` to `high` is covered without a break. */
    spans(low: number, high: number): boolean {
      const found = merged[after(low)] ?? merged[after(low) - 1];
      return found !== undefined && found[0] <= low && found[1] >= high;
    },
  };
}

/** How a gap is matched: centred in it, or its length repeated after its end or before its start. */
type GapFit = 'centre' | 'after' | 'before';

/** The offsets that fit a moving box to a gap, in the order Excalidraw tries them. */
function gapFits(gap: Gap, box: Box): { fit: GapFit; offset: number }[] {
  const [pos, size, across, span] = gap.axis === 'x' ? (['x', 'w', 'y', 'h'] as const) : (['y', 'h', 'x', 'w'] as const);
  if (box[across] > gap.overlap[1] || box[across] + box[span] < gap.overlap[0]) return [];
  const fits: { fit: GapFit; offset: number }[] = [];
  if (gap.length > box[size]) fits.push({ fit: 'centre', offset: (gap.from + gap.to) / 2 - (box[pos] + box[size] / 2) });
  fits.push({ fit: 'after', offset: gap.end[pos] + gap.end[size] + gap.length - box[pos] });
  fits.push({ fit: 'before', offset: gap.start[pos] - gap.length - (box[pos] + box[size]) });
  return fits.map((f) => ({ ...f, offset: round(f.offset) }));
}

/** The nearest offset on one axis within `reach`, or 0. */
function nearest(refs: References, points: Point[], box: Box | null, axis: Axis, reach: number): number {
  let best = reach;
  let chosen: number | null = null;
  const consider = (offset: number) => {
    const distance = Math.abs(offset);
    if (distance > best) return false;
    if (chosen === null || distance < best) chosen = offset;
    best = distance;
    return true;
  };
  for (const point of points) {
    for (const value of besideIn(refs.lines[axis].values, point[axis])) consider(round(value - point[axis]));
  }
  if (box) {
    for (const gap of refs.gaps) {
      if (gap.axis !== axis) continue;
      for (const fit of gapFits(gap, box)) if (consider(fit.offset)) break;
    }
  }
  return chosen ?? 0;
}

const shifted = (point: Point, by: Point): Point => ({ x: point.x + by.x, y: point.y + by.y });

/** Lines through every point of `points` that lines up exactly with a target. */
function pointGuides(refs: References, points: Point[]): Guide[] {
  const guides: Guide[] = [];
  for (const axis of ['x', 'y'] as const) {
    const lines = new Map<number, Map<string, Point>>();
    for (const point of points.map(rounded)) {
      for (const ref of refs.lines[axis].at.get(point[axis]) ?? []) {
        const line = lines.get(point[axis]) ?? new Map<string, Point>();
        line.set(`${point.x},${point.y}`, point);
        line.set(`${ref.x},${ref.y}`, ref);
        lines.set(point[axis], line);
      }
    }
    const other = axis === 'x' ? 'y' : 'x';
    for (const line of lines.values()) {
      guides.push({ kind: 'points', points: [...line.values()].sort((a, b) => a[other] - b[other]) });
    }
  }
  return guides;
}

/** The spacing marks for every gap the box fits exactly: the gap, and the one it made. */
function gapGuides(refs: References, box: Box): Guide[] {
  const guides = new Map<string, Guide>();
  for (const gap of refs.gaps) {
    for (const { fit, offset } of gapFits(gap, box)) {
      if (offset !== 0) continue;
      const x = gap.axis === 'x';
      const [pos, size, across, span] = x ? (['x', 'w', 'y', 'h'] as const) : (['y', 'h', 'x', 'w'] as const);
      // Along the middle of the range the gap and the box share.
      const middle = round((Math.max(gap.overlap[0], box[across]) + Math.min(gap.overlap[1], box[across] + box[span])) / 2);
      const near = box[pos];
      const far = box[pos] + box[size];
      const spans: [number, number][] =
        fit === 'centre'
          ? [[gap.from, near], [far, gap.to]]
          : fit === 'after'
            ? [[gap.from, gap.to], [gap.end[pos] + gap.end[size], near]]
            : [[far, gap.start[pos]], [gap.from, gap.to]];
      for (const [a, b] of spans) {
        const from = x ? { x: round(a), y: middle } : { x: middle, y: round(a) };
        const to = x ? { x: round(b), y: middle } : { x: middle, y: round(b) };
        guides.set(`${gap.axis}:${from.x},${from.y}:${to.x},${to.y}`, { kind: 'gap', axis: gap.axis, from, to });
      }
    }
  }
  return [...guides.values()];
}

/**
 * Snap a dragged selection: `points` are what it offers (`movingPoints`) and
 * `box` its upright bounds, both where the pointer has put it. Returns the
 * offset to add to the move, and the guides at the snapped place.
 */
export function snapMove(refs: References, points: Point[], box: Box, reach: number): Snap {
  const offset = { x: nearest(refs, points, box, 'x', reach), y: nearest(refs, points, box, 'y', reach) };
  const placed = { ...box, x: box.x + offset.x, y: box.y + offset.y };
  const moved = points.map((point) => shifted(point, offset));
  return { offset, guides: [...pointGuides(refs, moved), ...gapGuides(refs, placed)] };
}

/**
 * Snap the corners a resize or a drawing moves, to points only (Excalidraw
 * keeps equal spacing for drags). The caller keeps only the axes the handle
 * moves along, and draws the guides of the box it ends with (`guidesFor`).
 */
export function snapCorners(refs: References, points: Point[], reach: number): { offset: Point } {
  return { offset: { x: nearest(refs, points, null, 'x', reach), y: nearest(refs, points, null, 'y', reach) } };
}

/** The guides for a box as it ends up after a resize or a drawing: its exact alignments. */
export function guidesFor(refs: References, box: Box): Guide[] {
  return pointGuides(refs, boxPoints(box));
}

/**
 * Snap the pointer before a drawing starts: to the nearest target point on
 * each axis, with a line from that point to the pointer.
 */
export function snapPointer(refs: References, point: Point, reach: number): { point: Point; guides: Guide[] } {
  const offset = { x: nearest(refs, [point], null, 'x', reach), y: nearest(refs, [point], null, 'y', reach) };
  const snapped = rounded(shifted(point, offset));
  const guides: Guide[] = [];
  for (const axis of ['x', 'y'] as const) {
    const other = axis === 'x' ? 'y' : 'x';
    const aligned = refs.lines[axis].at.get(snapped[axis]) ?? [];
    if (aligned.length === 0) continue;
    const from = aligned.reduce((a, b) => (Math.abs(b[other] - snapped[other]) < Math.abs(a[other] - snapped[other]) ? b : a));
    guides.push({ kind: 'pointer', from, to: snapped });
  }
  return { point: snapped, guides };
}
