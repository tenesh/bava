/**
 * What each style key means when a file leaves it out, apart from the rest of
 * `style.ts` so the drawing code can read it without importing the editing
 * code (which imports the drawing code in turn).
 */
import type { PropertyKey, PropertyValue } from './style';

/**
 * What each property means when the key is absent, as `docs/file-format.md`
 * records it. `align` has no single default (centred in a shape, left in free
 * text) and is always written.
 */
export const PROPERTY_DEFAULTS: Partial<Record<PropertyKey, PropertyValue>> = {
  strokeWidth: 2,
  strokeStyle: 'solid',
  edges: 'sharp',
  opacity: 100,
  fontSize: 20,
  verticalAlign: 'middle',
  arrowType: 'straight',
  startArrowhead: 'none',
  endArrowhead: 'arrow',
  labelDirection: 'upright',
};

/** A code block's size when its file names none (`docs/file-format.md`). */
export const CODE_FONT_SIZE = 13;

