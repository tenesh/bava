/**
 * A Space's initial tile takes one of the shape swatches, chosen from its name
 * so the same Space keeps the same colour wherever it is listed.
 */
import type { Swatch } from '../canvas/palette';

/** The swatches a tile may take: gray reads as disabled, so it is left out. */
export const SPACE_TILE_SWATCHES = ['blue', 'green', 'purple', 'orange', 'pink', 'yellow', 'red'] as const satisfies readonly Swatch[];

export type SpaceTileSwatch = (typeof SPACE_TILE_SWATCHES)[number];

/** The swatch for a Space's tile: stable for a name, whatever its case. */
export function spaceTileSwatch(name: string): SpaceTileSwatch {
  const key = name.trim().toLowerCase();
  // FNV-1a: cheap, and spreads short names well.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return SPACE_TILE_SWATCHES[hash % SPACE_TILE_SWATCHES.length];
}

/** A Space's initial, for its tile. */
export function spaceInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '·';
}

/** The tile's background, as a token reference. */
export function tileFill(name: string): string {
  return `var(--swatch-${spaceTileSwatch(name)}-fill)`;
}

/** The tile's initial colour, as a token reference. */
export function tileText(name: string): string {
  return `var(--swatch-${spaceTileSwatch(name)}-text)`;
}
