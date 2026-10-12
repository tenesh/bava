/**
 * Where a shape's label sits: the rectangle inside the shape that keeps the
 * text clear of its edges, curved or slanted, less the label inset on every
 * side. In the element's own space (`0..w`, `0..h`).
 *
 * The stage, the label editor and the SVG export all place a label here, and
 * a shape grows to the height `neededHeight` gives so its label always fits.
 */

import { isShapeType } from './scene';
import { CYLINDER_LID, CYLINDER_LID_MAX, DOCUMENT_WAVE, HEXAGON_SLANT, PARALLELOGRAM_SLANT } from './shapes';
import { wrapLines } from './text-layout';

export type Area = { x: number; y: number; w: number; h: number };

/** How near the height a label needs is found, in scene units. */
const HEIGHT_PRECISION = 0.01;
/** Breaks of a label at successive heights before the last height found is taken. */
const BREAK_ROUNDS = 8;

/** The rectangle inside the outline, before the inset, by the shares `shapes.ts` draws with. */
function within(type: string, w: number, h: number): Area {
  switch (type) {
    case 'ellipse': {
      // The largest box inside an ellipse: each side 1/√2 of its axis.
      const iw = w / Math.SQRT2;
      const ih = h / Math.SQRT2;
      return { x: (w - iw) / 2, y: (h - ih) / 2, w: iw, h: ih };
    }
    case 'diamond':
      return { x: w / 4, y: h / 4, w: w / 2, h: h / 2 };
    case 'hexagon': {
      const slant = Math.min(w * HEXAGON_SLANT, h * 0.5);
      return { x: slant, y: 0, w: w - slant * 2, h };
    }
    case 'parallelogram': {
      const slant = Math.min(w * PARALLELOGRAM_SLANT, h * 0.5);
      return { x: slant, y: 0, w: w - slant * 2, h };
    }
    case 'cylinder': {
      // Below the lid, above the curve of the base.
      const ry = Math.min(h * CYLINDER_LID, w * CYLINDER_LID_MAX);
      return { x: 0, y: ry * 2, w, h: h - ry * 3 };
    }
    case 'document':
      // Above the wave along the bottom.
      return { x: 0, y: 0, w, h: h * (1 - DOCUMENT_WAVE * 2) };
    case 'person':
      // On the shoulders, below the head.
      return { x: w * 0.18, y: h * 0.64, w: w * 0.64, h: h * 0.34 };
    case 'cloud':
      return { x: w * 0.2, y: h * 0.4, w: w * 0.6, h: h * 0.45 };
    default:
      return { x: 0, y: 0, w, h };
  }
}

/** Where a label of a shape `type` sits, `w` by `h`, less `inset` on each side. */
export function labelArea(type: string, w: number, h: number, inset: number): Area {
  const box = within(type, w, h);
  const aw = Math.max(0, box.w - inset * 2);
  const ah = Math.max(0, box.h - inset * 2);
  return { x: box.x + (box.w - aw) / 2, y: box.y + (box.h - ah) / 2, w: aw, h: ah };
}

/**
 * The least height a shape of `type`, `w` wide, needs for a label
 * `textHeight` tall. The area grows with the height but not always in step
 * (a slant stops growing once it reaches its share of the width), so the
 * height is found by halving, to within `HEIGHT_PRECISION`.
 */
export function neededHeight(type: string, w: number, textHeight: number, inset: number): number {
  if (!(textHeight > 0)) return 0;
  const fits = (h: number) => labelArea(type, w, h, inset).h >= textHeight;
  let high = textHeight + inset * 2;
  while (!fits(high)) high *= 2;
  let low = 0;
  while (high - low > HEIGHT_PRECISION) {
    const mid = (low + high) / 2;
    if (fits(mid)) high = mid;
    else low = mid;
  }
  return Math.ceil(high * 100) / 100;
}

/** A label as both renderers draw it: its lines, and the box they sit in. */
export type PlacedLabel = Area & { lines: string[]; verticalAlign: 'top' | 'middle' | 'bottom' };

/**
 * A label in a shape of `type`, `w` by `h`: broken to its area's width, a
 * word too wide split across lines, placed as the label asks. A label taller
 * than the area starts at its top and runs on past the bottom, never cut: a
 * shape grows to hold its label when edited, but a file saved where text
 * measures narrower opens as it was saved.
 */
export function placeLabel(
  type: string,
  w: number,
  h: number,
  label: string,
  inset: number,
  font: { size: number; lineHeight: number; verticalAlign: 'top' | 'middle' | 'bottom' },
  measure: (line: string) => number,
): PlacedLabel {
  const area = labelArea(type, w, h, inset);
  const lines = wrapLines(label, area.w, measure, { breakWords: true });
  const height = lines.length * font.size * font.lineHeight;
  if (height > area.h) return { ...area, h: height, lines, verticalAlign: 'top' };
  return { ...area, lines, verticalAlign: font.verticalAlign };
}

/**
 * Grows a labelled shape to the height its label needs, `need` giving it as
 * it would be drawn; true when it grew. A shape already tall enough keeps its
 * height: a label never shrinks what the user made tall. Frames, whose label
 * is their title, arrows and text are not shapes and are left alone.
 */
export function growToLabel(element: { type: string; h: number; label?: string }, need: (element: never) => number): boolean {
  if (!element.label || !isShapeType(element.type)) return false;
  const height = need(element as never);
  if (!(height > element.h)) return false;
  element.h = height;
  return true;
}

/**
 * The height a shape of `type`, `w` wide and now `h` tall, needs for `label`
 * as it is drawn. Some areas narrow as a shape grows taller (a slant grows
 * with the height until it reaches its share of the width), so the label is
 * broken again at each height found until the height holds every line.
 */
export function labelHeight(
  type: string,
  w: number,
  h: number,
  label: string,
  inset: number,
  font: { size: number; lineHeight: number; verticalAlign: 'top' | 'middle' | 'bottom' },
  measure: (line: string) => number,
): number {
  let height = h;
  for (let round = 0; round < BREAK_ROUNDS; round += 1) {
    const lines = placeLabel(type, w, height, label, inset, font, measure).lines.length;
    const need = neededHeight(type, w, lines * font.size * font.lineHeight, inset);
    if (need <= height) return need;
    height = need;
  }
  return height;
}
