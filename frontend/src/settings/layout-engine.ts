/**
 * The layout engines `internal/layout` resolves. TALA is the default; dagre
 * and elk are alternatives the user picks, not fallbacks (CLAUDE.md, "D2
 * usage"). Types and a guard only, with no runtime imports, so presentational
 * components can name an engine without reaching the settings' IPC.
 */
export type LayoutEngine = 'tala' | 'dagre' | 'elk';

/** A diagram's direction. TALA ignores it. */
export type Direction = 'down' | 'right' | 'up' | 'left';

export function isLayoutEngine(value: string): value is LayoutEngine {
  return value === 'tala' || value === 'dagre' || value === 'elk';
}
