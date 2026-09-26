/**
 * Wrapping a code block's lines to its width.
 *
 * A block's width is the user's (`docs/file-format.md`, "Code blocks"): a line
 * that does not fit continues on the next, broken after its last space that
 * fits, or at the edge for a word too long. One rule, used by the measurement,
 * the stage and the exporter, so a block is as tall as the lines each draws.
 */
import type { CodeMetrics } from './measure';
import type { Run } from './highlight';

/**
 * How many mono columns a string occupies.
 *
 * Not its length: a CJK glyph is two columns wide in every terminal and
 * editor, an emoji is one glyph across two code units, and a combining mark
 * draws on the glyph before it rather than beside it. Counting code units put
 * every run after a wide glyph on top of the text before it, and under-sized
 * the panel so the code spilled out of it.
 */
export function columnsIn(text: string): number {
  let columns = 0;
  for (const glyph of text) {
    const point = glyph.codePointAt(0) ?? 0;
    if (COMBINING.test(glyph)) continue;
    columns += WIDE.test(glyph) || point > 0xffff ? 2 : 1;
  }
  return columns;
}

/** East Asian Wide and Fullwidth ranges, and the emoji blocks. */
const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6]/u;
const COMBINING = /\p{Mn}|\p{Me}/u;

/** How many columns fit across a block `width` wide, inside its padding; at least one. */
export function columnsFor(width: number, metrics: CodeMetrics): number {
  if (metrics.advance <= 0) return 1;
  // A quarter of a column of slack: a stored width is tidied to three
  // decimals, and the mono advance differs by a fraction between WebKit,
  // WebKitGTK and WebView2, so a block sized to its longest line on one must
  // not wrap it on another.
  return Math.max(1, Math.floor((width - metrics.padding * 2) / metrics.advance + 0.25));
}

/** Where each visual line of `line` starts, as string offsets; the first is 0. */
function breaksIn(line: string, columns: number): number[] {
  const starts = [0];
  let start = 0;
  let used = 0;
  // The offset just after the last space since `start`, where a break is kind.
  let afterSpace = -1;
  let offset = 0;
  for (const glyph of line) {
    const width = columnsIn(glyph);
    if (used + width > columns && offset > start) {
      const cut = afterSpace > start ? afterSpace : offset;
      starts.push(cut);
      start = cut;
      used = columnsIn(line.slice(cut, offset));
      afterSpace = -1;
      // What was carried over, plus this glyph, may still not fit (a wide
      // glyph after a break at a space): break again, hard, before the glyph.
      if (used + width > columns && offset > start) {
        starts.push(offset);
        start = offset;
        used = 0;
      }
    }
    used += width;
    offset += glyph.length;
    if (glyph === ' ') afterSpace = offset;
  }
  return starts;
}

/** A line broken into the visual lines it wraps to. */
export function wrapLine(line: string, columns: number): string[] {
  const starts = breaksIn(line, columns);
  return starts.map((start, i) => line.slice(start, starts[i + 1] ?? line.length));
}

/**
 * Highlighted lines broken where their text wraps, each run split at the
 * break and keeping its kind.
 */
export function wrapRuns(lines: Run[][], columns: number): Run[][] {
  const out: Run[][] = [];
  for (const line of lines) {
    const text = line.map((run) => run.text).join('');
    const starts = breaksIn(text, columns);
    let row: Run[] = [];
    let offset = 0;
    let next = 1;
    for (const run of line) {
      let piece = run.text;
      let at = offset;
      while (next < starts.length && starts[next] < at + piece.length) {
        const cut = starts[next] - at;
        if (cut > 0) row.push({ text: piece.slice(0, cut), kind: run.kind });
        out.push(row);
        row = [];
        piece = piece.slice(cut);
        at = starts[next];
        next += 1;
      }
      if (piece.length > 0) row.push({ text: piece, kind: run.kind });
      offset += run.text.length;
    }
    out.push(row);
  }
  return out;
}
