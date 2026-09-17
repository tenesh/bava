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
