/**
 * An icon element for an icon just picked: a square `ICON_SIDE` across,
 * centred where it lands, in the theme's ink and unlabelled.
 */
import type { IconElement } from './scene';

/** The side, in scene units, an icon is given when added. */
export const ICON_SIDE = 64;

export function placedIcon(icon: string, at: { x: number; y: number }): IconElement {
  return { id: '', type: 'icon', icon, x: at.x - ICON_SIDE / 2, y: at.y - ICON_SIDE / 2, w: ICON_SIDE, h: ICON_SIDE, z: 0 };
}
