/**
 * Shape colours: named swatches, resolved per theme.
 *
 * A file stores a swatch *name* (`"blue"`), never a colour: each swatch has a
 * light and a dark value, defined as tokens in `styles/tokens/_swatches.scss`,
 * so a choice stays readable when the theme changes. Konva needs concrete
 * colours, so the stage reads the CSS variables through `read` at render time.
 */
export const SWATCHES = ['gray', 'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink'] as const;

export type Swatch = (typeof SWATCHES)[number];

export type StyleKeys = { fill?: string; stroke?: string; color?: string };

export type ResolvedStyle = { fill: string; stroke: string; text: string };

/** Reads a CSS custom property's value, e.g. from `getComputedStyle`. */
export type ReadVariable = (name: string) => string;

export function isSwatch(name: unknown): name is Swatch {
  return typeof name === 'string' && (SWATCHES as readonly string[]).includes(name);
}

function pick(value: unknown, part: 'fill' | 'stroke' | 'text', read: ReadVariable): string {
  // An unknown name, from a newer Bava, draws as the default; the file keeps it.
  const name = isSwatch(value) ? `--swatch-${value}-${part}` : `--color-shape-${part}`;
  // Every name resolved here is defined in both themes, held by tokens.test.ts.
  return read(name).trim();
}

export function resolveStyle(element: StyleKeys, read: ReadVariable): ResolvedStyle {
  return {
    fill: pick(element.fill, 'fill', read),
    stroke: pick(element.stroke, 'stroke', read),
    text: pick(element.color, 'text', read),
  };
}

/** The app's reader: the document root's computed style. */
export function readRootVariable(name: string): string {
  const root = globalThis.document?.documentElement;
  return root ? getComputedStyle(root).getPropertyValue(name) : '';
}
