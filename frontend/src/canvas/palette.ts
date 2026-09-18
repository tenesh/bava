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

/**
 * The smallest difference in relative luminance a colour needs against the
 * canvas to be drawn as stored. Chosen so the palette's own extremes read: a
 * yellow on the light canvas differs by 0.11 and stays itself, while a
 * near-black on the dark canvas differs by 0.03 and is lifted.
 */
const MIN_CONTRAST = 0.1;

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

/**
 * A picked colour, adapted to the canvas it is drawn on.
 *
 * Drawn as stored where it differs enough in luminance from the canvas. Where
 * it does not, its lightness is mirrored about the middle, keeping the hue,
 * and lifted further if that still reads poorly. The rule uses only the value
 * and the canvas, so the file never records which theme it was picked in.
 */
export function adaptLiteral(hex: string, canvas: string): string {
  if (!HEX.test(canvas)) return hex;
  const against = luminance(canvas);
  if (Math.abs(luminance(hex) - against) >= MIN_CONTRAST) return hex;

  const [r, g, b] = channels(hex);
  const mirrored: [number, number, number] = [1 - r, 1 - g, 1 - b];
  let adapted = toHex(mirrored);
  // Mirroring a mid grey lands near itself; push away from the canvas until it
  // reads, or give up at the extreme.
  const away = against > 0.5 ? -1 : 1;
  for (let step = 0; step < 10 && Math.abs(luminance(adapted) - against) < MIN_CONTRAST; step += 1) {
    adapted = toHex(channels(adapted).map((value) => value + away * 0.08) as [number, number, number]);
  }
  return adapted;
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
