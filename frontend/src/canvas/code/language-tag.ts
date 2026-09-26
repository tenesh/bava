/**
 * A code block's language, named on its top edge near the left, the border
 * hidden behind it (06.17, the user's request). The stage and the exporter
 * both lay it out here, so the name and the break in the border agree.
 */
import type { SceneElement } from '../scene';
import { LANGUAGES } from './languages';

export type LanguageTag = {
  text: string;
  /** Where the name is, in the block's own coordinates: its top edge is y 0. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The stretch of the top border hidden behind it. */
  gap: { x: number; y: number; w: number; h: number };
};

/**
 * The tag for a block, or null for plain text or a language Bava does not
 * know (it is kept in the file, and drawn as plain text, so it is not named).
 */
export function languageTag(
  element: SceneElement,
  measure: (text: string) => number,
  /** `clearance`: how far round the name the border is hidden. */
  font: { size: number; lineHeight: number; inset: number; clearance: number },
): LanguageTag | null {
  const name = (element as { language?: string }).language;
  const language = name === undefined ? undefined : LANGUAGES.find((entry) => entry.name === name);
  if (!language) return null;
  const w = measure(language.label);
  const h = font.size * font.lineHeight;
  const x = font.inset;
  const y = -h / 2;
  return {
    text: language.label,
    x,
    y,
    w,
    h,
    gap: { x: x - font.clearance, y, w: w + font.clearance * 2, h },
  };
}
