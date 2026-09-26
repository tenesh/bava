/**
 * How big a code block is.
 *
 * Its width is the user's and its height comes from its code (decided
 * 2026-09-26, replacing "sized by its code"): lines wrap to the width
 * (`wrap.ts`) and the height is the wrapped line count, so nothing it holds is
 * ever hidden. A new block starts as wide as its longest line, at least
 * `MIN_COLUMNS`.
 *
 * Geist Mono is monospaced, so one advance describes every glyph and a line's
 * width is its character count. Measuring each line with a canvas would be
 * both slower and less stable across the two webviews.
 */
import { tidy } from '../resize';
import { columnsFor, columnsIn, wrapLine } from './wrap';

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

// Column counting lives with wrapping, which needs it too; re-exported here,
// where the stage and exporter have always imported it.
export { columnsIn } from './wrap';

/**
 * The narrowest a block is, in columns: room to type into. A new block is
 * empty, and one sized to a single column showed one character of anything
 * typed (`docs/file-format.md`, "Code blocks"). A count, not a length, so a
 * constant rather than a token.
 */
export const MIN_COLUMNS = 20;

/** The narrowest a code block can be resized to, in columns. A count, as above. */
export const MIN_RESIZE_COLUMNS = 4;

/**
 * The size of the panel that holds `code`. With a `width`, the block is that
 * wide and its lines wrap to it (`docs/file-format.md`, "Code blocks"); without,
 * it is as wide as its longest line, which is how a new block is sized.
 */
export function measureCode(code: string, metrics: CodeMetrics, width?: number): { width: number; height: number } {
  const lines = code.replace(/\t/g, TAB).split('\n');
  if (width !== undefined) {
    const columns = columnsFor(width, metrics);
    const rows = lines.reduce((total, line) => total + wrapLine(line, columns).length, 0);
    return { width: tidy(width), height: tidy(rows * metrics.lineHeight + metrics.padding * 2) };
  }
  const longest = Math.max(...lines.map(columnsIn));
  return {
    // An empty block is still a block: one line tall, and wide enough to
    // type into.
    width: tidy(Math.max(longest, MIN_COLUMNS) * metrics.advance + metrics.padding * 2),
    height: tidy(lines.length * metrics.lineHeight + metrics.padding * 2),
  };
}
