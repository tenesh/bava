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

