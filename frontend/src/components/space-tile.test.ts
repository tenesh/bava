import { describe, expect, it } from 'vitest';
import { SPACE_TILE_SWATCHES, spaceInitial, spaceTileSwatch, tileFill, tileText } from './space-tile';
import { SWATCHES } from '../canvas/palette';

describe('spaceTileSwatch', () => {
  it('picks the same colour for the same name every time', () => {
    expect(spaceTileSwatch('Acme Product')).toBe(spaceTileSwatch('Acme Product'));
  });

  it('ignores case and surrounding space, so a renamed-by-case Space keeps its colour', () => {
    expect(spaceTileSwatch('  acme product ')).toBe(spaceTileSwatch('Acme Product'));
  });

  it('only picks swatches that exist, and never gray', () => {
    for (const name of SPACE_TILE_SWATCHES) expect(SWATCHES).toContain(name);
    expect(SPACE_TILE_SWATCHES).not.toContain('gray');
  });

  it('spreads different names over several colours', () => {
    const names = ['Acme Product', 'Personal notes', 'Thesis', 'Website redesign', 'Bava', 'Recipes', 'Travel', 'Garden'];
    const picked = new Set(names.map(spaceTileSwatch));
    expect(picked.size).toBeGreaterThan(2);
  });

  it('gives an empty name a colour too', () => {
    expect(SPACE_TILE_SWATCHES).toContain(spaceTileSwatch(''));
  });

  it('refers to the swatch tokens for the tile, never a colour', () => {
    const swatch = spaceTileSwatch('Thesis');
    expect(tileFill('Thesis')).toBe(`var(--swatch-${swatch}-fill)`);
    expect(tileText('Thesis')).toBe(`var(--swatch-${swatch}-text)`);
  });

  it('takes the first letter as the initial', () => {
    expect(spaceInitial(' acme')).toBe('A');
    expect(spaceInitial('  ')).toBe('·');
  });
});
