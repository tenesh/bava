/**
 * Breaking text into the lines that are drawn.
 *
 * One line-breaker for both renderers. Konva wraps text itself, and the SVG
 * exporter cannot see inside it, so leaving each to its own wrapping meant the
 * same label sat on two lines in the app and ran out of its shape in an
 * exported file. The stage now hands Konva text that is already broken here,
 * with wrapping switched off, and the exporter breaks it the same way
 * (`.ai/rules/canvas.md`).
 */

/** Measures one line, in the same units as `maxWidth`. */
export type MeasureLine = (line: string) => number;

/**
 * `text` broken to fit `maxWidth`, keeping the line breaks the user typed.
 *
 * Breaks on spaces only. A word wider than the box is left on its own line and
 * overflows, as Konva does: cutting a word mid-glyph is worse than a label
 * that visibly does not fit. A width of zero or less means no wrapping.
 */
export function wrapLines(text: string, maxWidth: number, measure: MeasureLine): string[] {
  const paragraphs = text.split('\n');
  if (!(maxWidth > 0)) return paragraphs;

  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (line !== '' && measure(candidate) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Where text is drawn so a word wider than its box shows whole, as
 * `wrapLines` leaves it: the box itself when the widest line fits, else
 * widened to that line, both ways when centred, to the right when
 * left-aligned and to the left when right-aligned. Konva cuts any line wider
 * than a fixed width, even with wrapping off.
 */
export function overflowBox(x: number, width: number, widest: number, align: string): { x: number; width: number } {
  if (!(widest > width)) return { x, width };
  const extra = widest - width;
  if (align === 'left') return { x, width: widest };
  if (align === 'right') return { x: x - extra, width: widest };
  return { x: x - extra / 2, width: widest };
}
