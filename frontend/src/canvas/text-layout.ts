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
 * Breaks on spaces. A word wider than the box is left whole on its own line
 * and overflows, as a text element's does; with `breakWords` (a shape's
 * label, which must stay inside its shape) it is split where it meets the
 * edge instead, never mid-character, at least one character a line. A width
 * of zero or less means no wrapping, or for `breakWords` one character a line.
 */
export function wrapLines(text: string, maxWidth: number, measure: MeasureLine, options: { breakWords?: boolean } = {}): string[] {
  const paragraphs = text.split('\n');
  // No width at all: a label (which must stay inside) takes one character a
  // line; anything else is not wrapped.
  if (!(maxWidth > 0)) return options.breakWords ? paragraphs.flatMap((p) => Array.from(p.replace(/ /g, ''))) : paragraphs;

  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      if (options.breakWords && measure(word) > maxWidth) {
        // A word too wide for any line starts its own and breaks where it
        // meets the edge, as the editor's field breaks it; what follows its
        // last piece shares that line when it fits.
        if (line !== '') lines.push(line);
        let rest = word;
        for (;;) {
          // Nothing fits even on its own line: one character all the same.
          const piece = longestFitting(rest, (part) => measure(part) <= maxWidth) || Array.from(rest)[0];
          rest = rest.slice(piece.length);
          if (rest === '') {
            line = piece;
            break;
          }
          lines.push(piece);
        }
        continue;
      }
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

/** The longest start of `word`, whole characters, that `fits`; '' when none does. */
function longestFitting(word: string, fits: (part: string) => boolean): string {
  const chars = Array.from(word);
  let best = '';
  let part = '';
  for (const char of chars) {
    part += char;
    if (!fits(part)) break;
    best = part;
  }
  return best;
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
