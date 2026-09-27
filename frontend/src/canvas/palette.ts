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

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Whether a value is a literal colour rather than a swatch name. */
export function isLiteralColour(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

function channels(hex: string): [number, number, number] {
  const value = hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toHex([r, g, b]: [number, number, number]): string {
  const part = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

// How far dark mode inverts a picked colour: Excalidraw's invert(93%).
const INVERT = 0.93;

/**
 * A picked colour, as the canvas it is drawn on shows it.
 *
 * On a light canvas, exactly as picked. On a dark one, as Excalidraw's dark
 * mode shows it: inverted (93%, so white is not quite black) and its hue
 * turned 180 degrees back, so a pale blue fill becomes a deep blue one. The
 * rule uses only the value and the canvas, so the file never records which
 * theme it was picked in. Named swatches have their own designed dark values
 * and never come here.
 */
export function adaptLiteral(hex: string, canvas: string): string {
  if (!HEX.test(canvas) || luminance(canvas) >= 0.5) return hex;
  const [r, g, b] = channels(hex).map((c) => INVERT - (2 * INVERT - 1) * c);
  // CSS hue-rotate(180deg), as a matrix.
  return toHex([
    -0.574 * r + 1.43 * g + 0.144 * b,
    0.426 * r + 0.43 * g + 0.144 * b,
    0.426 * r + 1.43 * g - 0.856 * b,
  ]);
}

function pick(value: unknown, part: 'fill' | 'stroke' | 'text', read: ReadVariable): string {
  // A colour the user picked, kept as it is unless the theme swallows it.
  if (isLiteralColour(value)) return adaptLiteral(value, read('--color-canvas-bg').trim());
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
