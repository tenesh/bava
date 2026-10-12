/**
 * Text pasted onto the canvas, and a text element's size as its text
 * changes.
 *
 * Pasted text is one text element, its line breaks kept, wrapped at a set
 * width so a long paragraph is not one endless line. A text element narrower
 * than its text stays wrapped at that width as it is edited, growing taller;
 * one that is not grows with its longest line, as free text always has.
 */
import { wrapLines } from './text-layout';
import type { TextElement } from './scene';

type Font = { size: number; lineHeight: number };

/** The width, in scene units, pasted text wraps at. */
export const PASTED_TEXT_WIDTH = 400;

/** How much narrower than its longest line text must be to count as wrapped: measuring noise is not. */
const WRAP_TOLERANCE = 0.5;

/** Whether text `w` wide, its longest line `natural`, is drawn wrapped. */
export const isWrapped = (w: number, natural: number) => w < natural - WRAP_TOLERANCE;

/** The width of text's longest line: how wide it is unwrapped. */
export const longestLine = (text: string, widthOf: (line: string) => number) => Math.max(0, ...text.split('\n').map(widthOf));

/**
 * A text element's size for `text`: wrapped at its width `w` when that is
 * narrower than its text was (`natural`, its longest line), else its longest
 * line.
 */
export function textSize(text: string, was: { w: number; natural: number }, font: Font, widthOf: (line: string) => number): { width: number; height: number } {
  const line = font.size * font.lineHeight;
  if (isWrapped(was.w, was.natural)) return { width: was.w, height: wrapLines(text, was.w, widthOf).length * line };
  return { width: longestLine(text, widthOf), height: text.split('\n').length * line };
}

/** Text pasted onto the canvas, centred on `at`: one text element, wrapped at `maxWidth`. */
export function pastedText(text: string, at: { x: number; y: number }, font: Font, widthOf: (line: string) => number, maxWidth: number): TextElement {
  const natural = longestLine(text, widthOf);
  const size = textSize(text, { w: Math.min(natural, maxWidth), natural }, font, widthOf);
  return {
    id: '',
    type: 'text',
    text,
    x: at.x - size.width / 2,
    y: at.y - size.height / 2,
    w: size.width,
    h: size.height,
    z: 0,
    measuredWidth: size.width,
    measuredHeight: size.height,
  };
}
