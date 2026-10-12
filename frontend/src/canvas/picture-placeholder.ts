/**
 * What a picture element draws when its picture cannot be shown: a dashed box,
 * a picture icon struck through, and, once it is known to be missing, its
 * name. Laid out here once, so the stage and an export draw it alike.
 */
import { t } from '../i18n/t';

/** The icon, in its own 24 by 20 units: a frame, the sun, a hill, a strike. */
export const PICTURE_ICON = {
  w: 24,
  h: 20,
  path: 'M2 0h20a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2z M9 7a2 2 0 1 1-4 0a2 2 0 1 1 4 0z M24 15l-6-6-12 11 M-2-2L26 22',
};

/** The box and icon's lines, in scene units: dashed, its corners slightly rounded. */
export const PLACEHOLDER_LOOK = { dash: [4, 4], radius: 4, border: 1, iconStroke: 1.5 } as const;

/** A line's baseline below its top, as a share of its size: where SVG places text. */
export const BASELINE_SHARE = 0.8;

/** Space between the icon and the words, and between the two lines. */
const ICON_GAP = 12;
const LINE_GAP = 4;
/** Room kept clear inside the box, round what is drawn. */
const MARGIN = 8;

export type PictureState = 'loading' | 'missing';

export type PlaceholderLine = { text: string; kind: 'name' | 'note'; x: number; y: number; size: number };

export type PlaceholderLayout = {
  /** Where the icon sits, in the box's own units; null when the box is too small. */
  icon: { x: number; y: number; w: number; h: number } | null;
  /** Centred on `x`, each line's top at `y`. */
  lines: PlaceholderLine[];
};

/** The placeholder for a box `w` by `h`, for the file `name`. */
export function placeholderLayout(
  box: { w: number; h: number },
  name: string,
  state: PictureState,
  sizes: { name: number; note: number },
): PlaceholderLayout {
  const iconFits = box.w >= PICTURE_ICON.w + 2 * MARGIN && box.h >= PICTURE_ICON.h + 2 * MARGIN;
  if (!iconFits) return { icon: null, lines: [] };

  const words =
    state === 'missing'
      ? [
          { text: t('canvas.pictureMissing').replace('{name}', name), kind: 'name' as const, size: sizes.name },
          { text: t('canvas.pictureNotAttached'), kind: 'note' as const, size: sizes.note },
        ]
      : [];
  const wordsHeight = words.reduce((sum, line, i) => sum + line.size + (i > 0 ? LINE_GAP : 0), 0);
  const withWords = PICTURE_ICON.h + ICON_GAP + wordsHeight;
  const shown = words.length > 0 && box.h >= withWords + 2 * MARGIN ? words : [];
  const height = shown.length > 0 ? withWords : PICTURE_ICON.h;

  const top = (box.h - height) / 2;
  const icon = { x: (box.w - PICTURE_ICON.w) / 2, y: top, w: PICTURE_ICON.w, h: PICTURE_ICON.h };
  let y = top + PICTURE_ICON.h + ICON_GAP;
  const lines = shown.map((line, i) => {
    if (i > 0) y += LINE_GAP;
    const placed = { ...line, x: box.w / 2, y };
    y += line.size;
    return placed;
  });
  return { icon, lines };
}
