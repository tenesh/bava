/**
 * Reading the other theme's colours, for an export in a theme the user is not
 * looking at.
 *
 * The tokens are scoped to `:root[data-theme]` (`styles/tokens/_color.scss`),
 * so a probe element deeper in the document cannot carry a theme: the only way
 * to read dark values is to put the document element in dark for the length of
 * the read. The swap is synchronous, inside one task, so nothing paints in
 * between and the screen never flickers.
 */
import { readRootVariable, type ReadVariable } from '../palette';

const ATTRIBUTE = 'data-theme';
let swapping = false;

/**
 * Run `body` with the document in `theme`, and put the screen back afterwards,
 * whether `body` returns or throws.
 *
 * `body` must be synchronous: an await would let a paint happen with the wrong
 * theme on screen. Nesting is refused, because two swaps would each restore
 * what the other set.
 */
export function withTheme<T>(theme: 'light' | 'dark', body: (read: ReadVariable) => T): T {
  if (swapping) throw new Error('export: a theme swap cannot nest inside another');
  const root = globalThis.document?.documentElement;
  if (!root) return body(readRootVariable);

  const previous = root.getAttribute(ATTRIBUTE);
  swapping = true;
  root.setAttribute(ATTRIBUTE, theme);
  try {
    return body(readRootVariable);
  } finally {
    if (previous === null) root.removeAttribute(ATTRIBUTE);
    else root.setAttribute(ATTRIBUTE, previous);
    swapping = false;
  }
}
