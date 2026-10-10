import { t } from '../i18n/t';
import type { Point } from './viewport';
import type { Box } from './selection';

/** Whole canvas units, with no negative zero. */
const whole = (n: number) => Math.round(n) || 0;

/** The text shown beside a selection as it moves: its top-left corner. */
export function readoutText(box: Box): string {
  return t('canvas.position').replace('{x}', String(whole(box.x))).replace('{y}', String(whole(box.y)));
}

/**
 * Where the text sits, in scene units: below the box's bottom-left corner,
 * `gap` screen pixels away at any zoom.
 */
export function readoutAt(box: Box, zoom: number, gap: number): Point {
  return { x: box.x, y: box.y + box.h + gap / zoom };
}
