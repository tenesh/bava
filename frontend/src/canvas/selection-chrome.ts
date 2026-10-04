/**
 * What a selection shows: its outline, which resize handles, and the rotate
 * handle. One answer for the stage that draws them and the pointer that
 * presses them, so a handle is never drawn without working or the reverse.
 *
 * As Excalidraw (`transformHandles.ts:328-354`): one straight (two-point)
 * line or arrow, or one elbow arrow, shows no box at all, only its points; one
 * bent line or arrow shows the box with its four corners and the rotate
 * handle; anything else shows the box, all eight handles and, if it can turn,
 * the rotate handle.
 */
import { HANDLES, type Handle } from './resize';
import { canRotate } from './rotate';
import type { SceneElement } from './scene';
import { drawnPoints, fixedOf, spotOn, type Point } from './binding';
import { endSegment, headReach, LABEL_CLEARANCE } from './arrows';

/**
 * `padded`: the box stands clear of what it holds by `--size-bent-box-padding`
 * on screen, as Excalidraw's for a bent line (`transformHandles.ts:312-316`),
 * so its handles are not on top of its points. Only the box and its handles
 * move out; a resize still acts on the tight bounds, by the drag.
 */
export type Chrome = { box: boolean; handles: readonly Handle[]; rotate: boolean; padded?: boolean };

/** A box grown by `by` on every side. */
export function grown(box: { x: number; y: number; w: number; h: number }, by: number) {
  return { x: box.x - by, y: box.y - by, w: box.w + by * 2, h: box.h + by * 2 };
}

const CORNERS: readonly Handle[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

/**
 * A code block's height is the user's but never below its code
 * (`docs/file-format.md`, "Code blocks"): it grows from its bottom edge, so it
 * takes no top handle nor a top corner, which would move its top while its
 * height stops at its code.
 */
const CODE_HANDLES: readonly Handle[] = ['left', 'right', 'bottom', 'bottom-right', 'bottom-left'];

/**
 * Whether a line or arrow offers its segments' middles for bending: a
 * two-point one always, a bent one only in point editing (Excalidraw's
 * `interactiveScene.ts:1206-1217`). The stage draws them and the pointer
 * presses them by this one rule.
 */
export function offersMiddles(element: SceneElement, editing: boolean): boolean {
  // An elbow's middles are its segment handles (`elbowSegmentHandles`).
  if (element.type === 'arrow' && (element as { arrowType?: string }).arrowType === 'elbow') return false;
  const points = ('points' in element ? element.points : []) as number[];
  return points.length <= 4 || editing;
}

/**
 * Which selected element shows no chrome of its own while an editor works on
 * it: the line in point editing, else a code block whose editor is open (the
 * editor covers it). The stage draws by it and the pointer presses by it, so
 * a handle not drawn is not pressed.
 */
export function editingFor(selected: SceneElement[], pointEditing: string | null, textEditing: string | null): string | null {
  if (pointEditing) return pointEditing;
  return selected.length === 1 && selected[0].type === 'code' && textEditing === selected[0].id ? textEditing : null;
}

/** `editing`: the id of a line or arrow in point editing, which shows only its points. */
export function chromeFor(selected: SceneElement[], editing: string | null = null): Chrome {
  if (selected.length === 1 && editing === selected[0].id) return { box: false, handles: [], rotate: false };
  if (selected.length > 0 && selected.every((element) => element.type === 'code')) {
    return { box: true, handles: CODE_HANDLES, rotate: selected.some((e) => canRotate(e as { type: string; arrowType?: string })) };
  }
  if (selected.length === 1 && (selected[0].type === 'line' || selected[0].type === 'arrow')) {
    const element = selected[0];
    const points = ('points' in element ? element.points : []) as number[];
    const elbow = element.type === 'arrow' && (element as { arrowType?: string }).arrowType === 'elbow';
    if (elbow || points.length <= 4) return { box: false, handles: [], rotate: false };
    return { box: true, handles: CORNERS, rotate: true, padded: true };
  }
  return { box: true, handles: HANDLES, rotate: selected.some((e) => canRotate(e as { type: string; arrowType?: string })) };
}

/** A handle at the middle of an elbow's segment: which one, where, and whether it is fixed. */
export type SegmentHandle = { index: number; at: Point; fixed: boolean };

/**
 * The handles a selected elbow shows, one at the middle of each segment at
 * least `shortest` long (Excalidraw hides those under 5 screen px,
 * `linearElementEditor.ts:943-948`). Segment `index` runs from point
 * `index - 1` to point `index`. The stage draws them, filled when fixed, and
 * the pointer presses them, by this one rule.
 */
export function elbowSegmentHandles(element: SceneElement, shortest: number): SegmentHandle[] {
  if (element.type !== 'arrow' || (element as { arrowType?: string }).arrowType !== 'elbow') return [];
  const drawn = drawnPoints(element);
  const fixed = new Set(fixedOf(element));
  const out: SegmentHandle[] = [];
  for (let index = 1; index < drawn.length / 2; index += 1) {
    const [x1, y1, x2, y2] = drawn.slice(index * 2 - 2, index * 2 + 2);
    if (Math.hypot(x2 - x1, y2 - y1) < shortest) continue;
    out.push({ index, at: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, fixed: fixed.has(index) });
  }
  return out;
}

/** An attached end's anchor, shown on its shape: which end, where, and where the end is. */
export type FocusSpot = { side: 'start' | 'end'; at: Point; end: Point };

/**
 * The anchors a selected arrow shows, as Excalidraw's focus points
 * (`arrows/focus.ts:37-100`): a straight two-point arrow's attached ends,
 * each where its anchor is on its shape, unless that is within `apart` of the
 * end itself (the end's handle is there). An elbow shows none: its ends are
 * its anchors. The stage draws them and the pointer presses them by this rule.
 */
export function focusSpots(arrow: SceneElement, elements: SceneElement[], apart: number): FocusSpot[] {
  const points = ('points' in arrow ? arrow.points : []) as number[];
  if (arrow.type !== 'arrow' || (arrow as { arrowType?: string }).arrowType === 'elbow' || points.length !== 4) return [];
  const drawn = drawnPoints(arrow);
  const record = arrow as unknown as Record<string, unknown>;
  const out: FocusSpot[] = [];
  (['start', 'end'] as const).forEach((side, i) => {
    const shape = elements.find((e) => e.id === record[`${side}Binding`]);
    if (!shape) return;
    const at = spotOn(shape, record[`${side}Anchor`] as [number, number] | undefined);
    const end = { x: drawn[i * 2], y: drawn[i * 2 + 1] };
    if (Math.hypot(at.x - end.x, at.y - end.y) < apart) return;
    out.push({ side, at, end });
  });
  return out;
}


type Box = { x: number; y: number; w: number; h: number };

/**
 * How much longer the stretch towards the start must be than the one towards
 * the end before the handle goes that way: half a canvas unit, so two
 * stretches that differ only by rounding count as even and the handle keeps
 * to the end's side rather than flipping between them.
 */
const EVEN_WITHIN = 0.5;

/**
 * Where a handle at `at` on a labelled arrow is drawn and pressed: where it
 * is, unless the label's box grown by `clear` covers it; then where the drawn
 * `path` comes out of that box on the side with more line showing (the end's
 * side when they are even), so the label stays readable and a press on it
 * slides it. The spot keeps `ends[0]` from the path's start and `ends[1]`
 * from its end: room for what stands there, a head and its handle. Null when
 * neither side has such a spot, as when the label covers the whole line.
 * `clear` is the line's gap round the label and the handle's radius, so the
 * handle sits on the line where it shows again. The stage draws by this and
 * the pointer presses by it.
 */
export function besideLabel(at: Point, path: number[], label: Box | null, clear: number, ends: [number, number] = [0, 0]): Point | null {
  if (!label) return at;
  const box = grown(label, clear);
  const inside = (p: Point) => p.x > box.x && p.x < box.x + box.w && p.y > box.y && p.y < box.y + box.h;
  const count = path.length / 2;
  if (!inside(at) || count < 2) return at;
  const pointAt = (i: number): Point => ({ x: path[i * 2], y: path[i * 2 + 1] });

  // Where `at` is on the path: the nearest point of the nearest segment.
  let segment = 0;
  let from = pointAt(0);
  let nearest = Infinity;
  for (let i = 0; i < count - 1; i += 1) {
    const a = pointAt(i);
    const b = pointAt(i + 1);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / length));
    const on = { x: a.x + t * dx, y: a.y + t * dy };
    const distance = Math.hypot(at.x - on.x, at.y - on.y);
    if (distance < nearest) {
      nearest = distance;
      segment = i;
      from = on;
    }
  }

  /** Where the run from `a`, inside the box, to `b` leaves it, or null when `b` is inside too. */
  const leaving = (a: Point, b: Point): Point | null => {
    if (inside(b)) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let t = 1;
    if (dx > 0) t = Math.min(t, (box.x + box.w - a.x) / dx);
    if (dx < 0) t = Math.min(t, (box.x - a.x) / dx);
    if (dy > 0) t = Math.min(t, (box.y + box.h - a.y) / dy);
    if (dy < 0) t = Math.min(t, (box.y - a.y) / dy);
    t = Math.max(0, t);
    return { x: a.x + t * dx, y: a.y + t * dy };
  };

  const apart = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);
  /** Where the path leaves the box going one way from `from`, and how much line shows past it. */
  const leave = (step: 1 | -1): { at: Point; rest: number } | null => {
    let a = from;
    for (let i = step === 1 ? segment + 1 : segment; i >= 0 && i < count; i += step) {
      const out = leaving(a, pointAt(i));
      if (out) {
        let rest = apart(out, pointAt(i));
        for (let j = i; j + step >= 0 && j + step < count; j += step) rest += apart(pointAt(j), pointAt(j + step));
        return { at: out, rest };
      }
      a = pointAt(i);
    }
    return null;
  };

  const first = pointAt(0);
  const last = pointAt(count - 1);
  const towardsEnd = leave(1);
  const towardsStart = leave(-1);
  // Within EVEN_WITHIN the two stretches are even, and the end's side wins.
  const spots = [towardsEnd, towardsStart].filter((spot) => spot !== null);
  if (towardsEnd && towardsStart && towardsStart.rest > towardsEnd.rest + EVEN_WITHIN) spots.reverse();
  const room = spots.find((spot) => apart(spot.at, first) >= ends[0] && apart(spot.at, last) >= ends[1]);
  return room ? room.at : null;
}

/**
 * How far a handle beside an arrow's label keeps from the arrow's start and
 * its end (`besideLabel`'s `ends`): past the end's head, or its handle where
 * the head is smaller, then the gap and the handle's own `radius`. `path` is
 * the drawn route.
 */
export function labelSpotEnds(element: SceneElement, path: number[], radius: number): [number, number] {
  const heads = element as { startArrowhead?: string; endArrowhead?: string };
  const keep = (kind: string, side: 'start' | 'end') => Math.max(headReach(kind, endSegment(path, side)), radius) + LABEL_CLEARANCE + radius;
  return [keep(heads.startArrowhead ?? 'none', 'start'), keep(heads.endArrowhead ?? 'arrow', 'end')];
}
