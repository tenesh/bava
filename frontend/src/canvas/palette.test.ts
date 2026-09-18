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

// A picked colour is stored once and adapted to the theme it is drawn in:
// drawn as stored where it reads against the canvas, flipped in lightness
// where it does not (canvas-toolbar.md, "Colour").
describe('literal colours', () => {
  const light = (name: string) => (name === '--color-canvas-bg' ? '#efefec' : `var(${name})`);
  const dark = (name: string) => (name === '--color-canvas-bg' ? '#131416' : `var(${name})`);

  it('keeps a colour that reads against the canvas', () => {
    expect(resolveStyle({ fill: '#e03131' }, light).fill).toBe('#e03131');
    expect(resolveStyle({ fill: '#ffd43b' }, light).fill).toBe('#ffd43b');
  });

  it('lifts a near-black off a dark canvas, keeping its hue', () => {
    const adapted = resolveStyle({ stroke: '#1a1d21' }, dark).stroke;
    expect(adapted).not.toBe('#1a1d21');
    expect(adapted).toMatch(/^#[0-9a-f]{6}$/);
    expect(luminance(adapted)).toBeGreaterThan(luminance('#131416'));
  });

  it('darkens a near-white on a light canvas', () => {
    const adapted = resolveStyle({ fill: '#fbfbf9' }, light).fill;
    expect(adapted).not.toBe('#fbfbf9');
    expect(luminance(adapted)).toBeLessThan(luminance('#efefec'));
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
