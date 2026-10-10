import { describe, expect, it } from 'vitest';
import { TILE_FILL, TILE_TEXT, spaceInitial } from './space-tile';

describe('a Space tile', () => {
  // Black and white: every Space's letter sits on the ink, as the accent does.
  it('takes the accent for every Space, as token references', () => {
    expect(TILE_FILL).toBe('var(--color-accent)');
    expect(TILE_TEXT).toBe('var(--color-accent-contrast)');
  });

  it('takes the first letter as the initial', () => {
    expect(spaceInitial(' acme')).toBe('A');
    expect(spaceInitial('  ')).toBe('·');
  });
});
