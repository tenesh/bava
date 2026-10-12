/**
 * A picture element for a picture just added: at its own size, no larger than
 * `PICTURE_MAX_SIDE` on its longer side, centred where it lands.
 */
import type { ImageElement } from './scene';

/** The longest side, in scene units, a picture is given when added. */
export const PICTURE_MAX_SIDE = 480;

/** A picture whose own size is unknown (an SVG without one) is a square this size. */
const UNSIZED_SIDE = 240;

export function placedPicture(file: string, natural: { w: number; h: number }, at: { x: number; y: number }): ImageElement {
  const sized = natural.w > 0 && natural.h > 0 ? natural : { w: UNSIZED_SIDE, h: UNSIZED_SIDE };
  const scale = Math.min(1, PICTURE_MAX_SIDE / Math.max(sized.w, sized.h));
  const w = sized.w * scale;
  const h = sized.h * scale;
  return { id: '', type: 'image', file, x: at.x - w / 2, y: at.y - h / 2, w, h, z: 0 };
}
