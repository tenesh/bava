/**
 * The width of one character in the bundled mono face.
 *
 * Geist Mono is monospaced, so one measurement describes every glyph: the
 * canvas lays a line out by character count rather than measuring each run.
 * Measured once per font and cached, because this is called for every run of
 * every visible block.
 */
import { canvasLineWidth } from '../text-measure';

const cache = new Map<string, number>();

/** For tests: forget the measurements. */
export function resetAdvanceCache(): void {
  cache.clear();
}

/**
 * Forget the measurements once the bundled fonts have loaded.
 *
 * A measurement taken before Geist Mono resolves describes a fallback face,
 * and it would be written into `measuredWidth`/`measuredHeight` in the user's
 * file: the stored dimensions exist precisely so a scene does not reflow
 * elsewhere (`canvas/text-measure.ts`). Called once at startup.
 */
export function invalidateAdvanceOnFontLoad(): void {
  const fonts = (globalThis as { document?: { fonts?: { ready?: Promise<unknown> } } }).document?.fonts;
  void fonts?.ready?.then(() => cache.clear());
}

export function monoAdvance(size: number, family: string): number {
  const font = `${size}px ${family}`;
  const known = cache.get(font);
  if (known !== undefined) return known;
  // Ten characters, so a rounded per-character width does not compound.
  const measured = canvasLineWidth(font)('0000000000') / 10;
  cache.set(font, measured);
  return measured;
}
