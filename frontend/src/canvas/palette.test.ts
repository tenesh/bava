import { describe, expect, it } from 'vitest';
import { SWATCHES, isSwatch, resolveStyle } from './palette';

// A fake CSS variable reader: returns the variable's name, so the test reads
// which token was chosen rather than a colour.
const read = (name: string) => `var(${name})`;

describe('palette', () => {
  it('names eight swatches', () => {
    expect(SWATCHES).toEqual(['gray', 'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink']);
  });

  it('resolveStyle uses the theme defaults when an element names no swatch', () => {
    expect(resolveStyle({}, read)).toEqual({
      fill: 'var(--color-shape-fill)',
      stroke: 'var(--color-shape-stroke)',
      text: 'var(--color-shape-text)',
    });
  });

  it('resolveStyle uses each named swatch for its own property', () => {
    expect(resolveStyle({ fill: 'blue', stroke: 'red', color: 'green' }, read)).toEqual({
      fill: 'var(--swatch-blue-fill)',
      stroke: 'var(--swatch-red-stroke)',
      text: 'var(--swatch-green-text)',
    });
  });

  // A newer Bava may add swatches; an older one draws the default and keeps
  // the name in the file.
  it('resolveStyle treats an unknown swatch as the default', () => {
    expect(resolveStyle({ fill: 'ultraviolet' }, read).fill).toBe('var(--color-shape-fill)');
    expect(isSwatch('ultraviolet')).toBe(false);
    expect(isSwatch('pink')).toBe(true);
  });

});

// A picked colour shows as picked on a light canvas, and on a dark canvas is
// shown as Excalidraw's dark mode shows it: inverted, hue turned back.
describe('literal colours', () => {
  const light = (name: string) => (name === '--color-canvas-bg' ? '#efefec' : `var(${name})`);
  const dark = (name: string) => (name === '--color-canvas-bg' ? '#131416' : `var(${name})`);

  it('shows as picked on a light canvas, pale or not', () => {
    for (const colour of ['#e03131', '#ffd43b', '#fbfbf9', '#e6eef7', '#1a1d21']) {
      expect(resolveStyle({ fill: colour }, light).fill).toBe(colour);
    }
  });

  it('inverts white and black on a dark canvas as Excalidraw does', () => {
    expect(resolveStyle({ fill: '#ffffff' }, dark).fill).toBe('#121212');
    expect(resolveStyle({ stroke: '#000000' }, dark).stroke).toBe('#ededed');
  });

  it('turns a pale fill dark on a dark canvas, keeping its hue', () => {
    const adapted = resolveStyle({ fill: '#e6eef7' }, dark).fill;
    expect(luminance(adapted)).toBeLessThan(0.3);
    const [r, , b] = [1, 3, 5].map((i) => parseInt(adapted.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
  });

  it('draws a malformed value as the default', () => {
    expect(resolveStyle({ fill: '#12' }, light).fill).toBe('var(--color-shape-fill)');
    expect(resolveStyle({ fill: '#gggggg' }, light).fill).toBe('var(--color-shape-fill)');
  });
});

/** Rough relative luminance, enough to compare two colours in a test. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
