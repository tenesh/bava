/**
 * Resizing: the geometry of dragging a selection handle.
 *
 * Pure functions over boxes, so the parts easy to get subtly wrong (a handle
 * dragged past the opposite edge, aspect ratio from a corner, several elements
 * keeping their places in a group) are testable without a stage.
 */
import type { Box } from './selection';

export const HANDLES = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
] as const;

export type Handle = (typeof HANDLES)[number];

/** The smallest a resize may leave a box, in scene units. */
export const MIN_SIZE = 4;

/** Where each handle sits, as fractions of the box. */
const POSITION: Record<Handle, [number, number]> = {
  'top-left': [0, 0],
  top: [0.5, 0],
  'top-right': [1, 0],
  right: [1, 0.5],
  'bottom-right': [1, 1],
  bottom: [0.5, 1],
  'bottom-left': [0, 1],
  left: [0, 0.5],
};

export function handleCentre(box: Box, handle: Handle): { x: number; y: number } {
  const [fx, fy] = POSITION[handle];
  return { x: box.x + box.w * fx, y: box.y + box.h * fy };
}

/** The handle within `size` of a point, if any. Corners win over edges. */
export function handleAt(point: { x: number; y: number }, box: Box, size: number): Handle | null {
  for (const handle of HANDLES) {
    const centre = handleCentre(box, handle);
    if (Math.abs(point.x - centre.x) <= size && Math.abs(point.y - centre.y) <= size) return handle;
  }
  return null;
}

/**
 * The box after dragging `handle` by `dx, dy`. The opposite edge stays put, and
 * a handle dragged past it stops at the minimum size rather than flipping.
 */
export function resizeBox(box: Box, handle: Handle, dx: number, dy: number, options: { keepAspect?: boolean } = {}): Box {
  let left = box.x;
  let top = box.y;
  let right = box.x + box.w;
  let bottom = box.y + box.h;

  if (handle.includes('left')) left = Math.min(left + dx, right - MIN_SIZE);
  if (handle.includes('right')) right = Math.max(right + dx, left + MIN_SIZE);
  if (handle.startsWith('top')) top = Math.min(top + dy, bottom - MIN_SIZE);
  if (handle.startsWith('bottom')) bottom = Math.max(bottom + dy, top + MIN_SIZE);

  // A line has no width or height, so no ratio to keep.
  if (options.keepAspect && box.w > 0 && box.h > 0) {
    const aspect = box.w / box.h;
    const drivesHeight = handle === 'top' || handle === 'bottom';
    // The dragged edge drives one side; the other follows at the ratio, and
    // both are scaled up together if that would fall below the minimum, so a
    // collapsed drag still keeps the proportions.
    let width = drivesHeight ? (bottom - top) * aspect : right - left;
    let height = drivesHeight ? bottom - top : (right - left) / aspect;
    const scale = Math.max(1, MIN_SIZE / width, MIN_SIZE / height);
    width *= scale;
    height *= scale;
    // The edges the drag did not touch stay put: a top handle keeps the
    // bottom, a left handle keeps the right, and the width grows rightward.
    if (handle.startsWith('top')) top = bottom - height;
    else bottom = top + height;
    if (handle.includes('left')) left = right - width;
    else right = left + width;
  }

  return { x: left, y: top, w: right - left, h: bottom - top };
}

/**
 * An element's geometry moved from `from` into `to`, keeping its relative place
 * and scaling its relative points. How a multi-element resize keeps a group's
 * layout.
 */
export function scaleInto<T extends Box & { points?: number[]; type?: string }>(element: T, from: Box, to: Box): T {
  const sx = from.w === 0 ? 1 : to.w / from.w;
  const sy = from.h === 0 ? 1 : to.h / from.h;
  if (element.type === 'text' || element.type === 'code') {
    // Text and code keep their stored measurement, which must describe their
    // box: they move with the group but are not stretched.
    return { ...element, x: tidy(to.x + (element.x - from.x) * sx), y: tidy(to.y + (element.y - from.y) * sy) };
  }
  const scaled = {
    ...element,
    x: tidy(to.x + (element.x - from.x) * sx),
    y: tidy(to.y + (element.y - from.y) * sy),
    w: tidy(element.w * sx),
    h: tidy(element.h * sy),
  };
  if (element.points) scaled.points = element.points.map((value, i) => tidy(value * (i % 2 === 0 ? sx : sy)));
  return scaled;
}

/**
 * Three decimal places. Scaling by a ratio leaves floating-point dust
 * (220.00000000000003) that would otherwise be written into the user's file.
 */
export function tidy(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Where the rotate handle sits: centred above the box, `gap` scene units clear
 * of its top edge, so it is never mistaken for the top-middle resize handle.
 */
export function rotateHandleCentre(box: Box, gap: number): { x: number; y: number } {
  return { x: box.x + box.w / 2, y: box.y - gap };
}

/** Whether a point presses the rotate handle. */
export function isRotateHandle(point: { x: number; y: number }, box: Box, size: number, gap: number): boolean {
  const centre = rotateHandleCentre(box, gap);
  return Math.abs(point.x - centre.x) <= size && Math.abs(point.y - centre.y) <= size;
}
