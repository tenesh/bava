/**
 * How big a code block is.
 *
 * Its size comes from its code and nothing else (decided 2026-09-19): as wide
 * as the longest line, as tall as the line count, so nothing it holds is ever
 * hidden. That is why a code block has no resize handles.
 *
 * Geist Mono is monospaced, so one advance describes every glyph and a line's
 * width is its character count. Measuring each line with a canvas would be
 * both slower and less stable across the two webviews.
 */
import { tidy } from '../resize';

/**
 * A tab is drawn as this many spaces. Shared with the tokeniser: drawing a tab
 * at a different width than it is measured at would put every stored size
 * subtly wrong.
 */
export const TAB = '    ';

export type CodeMetrics = {
  /** The width of one character at the block's font size. */
  advance: number;
  lineHeight: number;
  /** Space inside the panel, on every side. */
  padding: number;
};

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

/** The size of the panel that holds `code`. */
export function measureCode(code: string, metrics: CodeMetrics): { width: number; height: number } {
  const lines = code.replace(/\t/g, TAB).split('\n');
  const longest = Math.max(...lines.map(columnsIn));
  return {
    // An empty block is still a block: one line tall, and wide enough to
    // click and to show a cursor in.
    width: tidy(Math.max(longest, 1) * metrics.advance + metrics.padding * 2),
    height: tidy(lines.length * metrics.lineHeight + metrics.padding * 2),
  };
}
