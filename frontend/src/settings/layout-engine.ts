/**
 * The layout engines `internal/layout` resolves. TALA is the default; dagre
 * and elk are alternatives the user picks, not fallbacks. Types, names and a
 * guard only, with no runtime imports, so presentational components can name an
 * engine without reaching the settings' IPC.
 */
export type LayoutEngine = 'tala' | 'dagre' | 'elk';

/**
 * Each engine's name as shown. Proper nouns, the same in every locale: names,
 * not message keys, as a language name is.
 */
export const ENGINE_NAMES: Record<LayoutEngine, string> = { tala: 'TALA', dagre: 'Dagre', elk: 'ELK' };

/** A diagram's direction. TALA ignores it. */
export type Direction = 'down' | 'right' | 'up' | 'left';

export function isLayoutEngine(value: string): value is LayoutEngine {
  return value === 'tala' || value === 'dagre' || value === 'elk';
}
