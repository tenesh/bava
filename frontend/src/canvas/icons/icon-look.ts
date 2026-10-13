/**
 * How an icon element looks, worked out once for the stage and the export:
 * its colour, the parts it is drawn from, where its label goes, and the
 * room it takes, label included (`docs/file-format.md`, "Icons").
 */
import { isDarkCanvas, resolveStyle, type ReadVariable } from '../palette';
import type { IconElement } from '../scene';
import { wrapLines, type MeasureLine } from '../text-layout';
import { iconEntry, type IconEntry } from './sets';

/** The narrowest a label wraps at, whatever the icon's size. */
export const ICON_LABEL_WIDTH = 160;
/** Between the icon's square and its label. */
export const ICON_LABEL_GAP = 6;

/** What `color` holds for a logo drawn in its owner's colour. */
export const BRAND = 'brand';

/**
 * The colour a bundled icon and its label draw in: a logo's own for Brand,
 * as it is in both themes; otherwise as text colours resolve, the theme's ink
 * when none is picked. (A custom icon keeps its own colours; its label takes this.)
 */
export function iconColour(element: IconElement, read: ReadVariable): string {
  if (element.color === BRAND) {
    const hex = iconEntry(element.icon)?.hex;
    if (hex) return `#${hex}`;
    return resolveStyle({}, read).text;
  }
  return resolveStyle({ color: element.color }, read).text;
}

/** One path of an icon, on its 24 grid, and how it is painted. */
export type IconPart = { d: string; fill: boolean; stroke: boolean; opacity: number };

const parts = new WeakMap<IconEntry, IconPart[]>();
const PATH = /<path ([^>]*?)\/?>/g;
const ATTRIBUTE = /([a-z-]+)="([^"]*)"/g;

/**
 * A bundled icon's paths: a line icon's stroked unless a part says it is
 * filled or unstroked; a filled icon's and a logo's filled.
 */
export function iconParts(entry: IconEntry): IconPart[] {
  const known = parts.get(entry);
  if (known) return known;
  const line = entry.set === 'line';
  const found: IconPart[] = [];
  for (const [, attributes] of (entry.body ?? '').matchAll(PATH)) {
    const values = Object.fromEntries([...attributes.matchAll(ATTRIBUTE)].map(([, key, value]) => [key, value]));
    if (!values.d) continue;
    found.push({
      d: values.d,
      fill: !line || values.fill === 'currentColor',
      stroke: line && values.stroke !== 'none',
      opacity: values.opacity === undefined ? 1 : Number(values.opacity),
    });
  }
  parts.set(entry, found);
  return found;
}

export type IconLabelLayout = {
  lines: string[];
  /** The label's box, centred under the icon, in the element's own units. */
  x: number;
  y: number;
  width: number;
};

/** Where an icon's label goes, broken to the wider of the icon and `ICON_LABEL_WIDTH`. */
export function iconLabelLayout(element: IconElement, measure: MeasureLine): IconLabelLayout {
  const width = Math.max(element.w, ICON_LABEL_WIDTH);
  const lines = element.label ? wrapLines(element.label, width, measure) : [];
  return { lines, x: element.w / 2 - width / 2, y: element.h + ICON_LABEL_GAP, width };
}

/**
 * The size a label takes under an icon, to store beside it: its widest
 * line, rounded up, and its lines at the font's size and leading.
 */
export function iconLabelSize(
  element: IconElement,
  label: string,
  measure: MeasureLine,
  font: { size: number; lineHeight: number },
): { width: number; height: number } {
  const lines = iconLabelLayout({ ...element, label }, measure).lines;
  const width = Math.ceil(Math.max(0, ...lines.map(measure)));
  return { width, height: lines.length * font.size * font.lineHeight };
}

/** The room an icon takes on the canvas: its square, and its label as measured. */
export function iconBounds(element: IconElement): { x: number; y: number; w: number; h: number } {
  const box = { x: element.x, y: element.y, w: element.w, h: element.h };
  if (!element.label || !element.measuredWidth || !element.measuredHeight) return box;
  const w = Math.max(element.w, element.measuredWidth);
  return { x: element.x + element.w / 2 - w / 2, y: element.y, w, h: element.h + ICON_LABEL_GAP + element.measuredHeight };
}

/** The SVG a custom icon draws: its dark copy on a dark canvas, when it has one. */
export function customSvg(entry: IconEntry, read: ReadVariable): string {
  return (isDarkCanvas(read) && entry.darkSvg) || entry.svg || '';
}

const ROOT_SIZE = /^<svg\b[^>]*?\swidth="([\d.]+)"[^>]*?\sheight="([\d.]+)"/;

/**
 * Where a custom icon's picture sits in its square: as large as fits, its own
 * proportions kept (its width and height, as cleaning sets them), centred.
 */
export function pictureBox(svg: string, w: number, h: number): { x: number; y: number; w: number; h: number } {
  const match = ROOT_SIZE.exec(svg);
  const ratio = match ? Number(match[1]) / Number(match[2]) : 0;
  if (!(ratio > 0) || !Number.isFinite(ratio)) return { x: 0, y: 0, w, h };
  const fit = Math.min(w / ratio, h);
  const width = fit * ratio;
  return { x: (w - width) / 2, y: (h - fit) / 2, w: width, h: fit };
}
