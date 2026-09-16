/**
 * The panda mark's drawing, read from the vendored SVG at build time.
 *
 * Components render the path themselves rather than injecting the file as
 * HTML: the colour must come from a token through `currentColor`, and there
 * is nothing in the file worth trusting `{@html}` with.
 */
import svg from './panda.svg?raw';

function attribute(source: string, name: string): string {
  const found = new RegExp(`\\s${name}="([^"]*)"`).exec(source)?.[1];
  if (found === undefined) throw new Error(`panda.svg has no ${name}`);
  return found;
}

const path = /<path\b[^>]*>/.exec(svg)?.[0] ?? '';

const viewBox = attribute(svg, 'viewBox');
const [, , width, height] = viewBox.split(/\s+/);

export const MARK = {
  viewBox,
  /** The drawing's own ratio, so a sized height fixes the width. */
  aspectRatio: `${width} / ${height}`,
  d: attribute(path, 'd'),
  transform: attribute(path, 'transform'),
};
