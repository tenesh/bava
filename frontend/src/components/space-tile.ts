/**
 * A Space's initial tile: its first letter on the accent, the same for
 * every Space, as the app is black and white.
 */

/** A Space's initial, for its tile. */
export function spaceInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '·';
}

/** The tile's background, as a token reference. */
export const TILE_FILL = 'var(--color-accent)';

/** The tile's initial colour, as a token reference. */
export const TILE_TEXT = 'var(--color-accent-contrast)';
