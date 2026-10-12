/**
 * A page's Canvas as one picture for its PDF: the whole Canvas, padded as an
 * export is, on the canvas's colour, as an SVG with its font inside.
 */
import { produce } from 'immer';
import { exportArea } from './area';
import { reroute } from '../binding';
import { fontCss, type FontOptions } from './fonts';
import { toSvg } from './svg';
import { withTheme } from './theme';
import type { ReadVariable } from '../palette';
import type { Run } from '../code/highlight';
import type { SceneData } from '../scene';

export type PagePicture = { svg: string; width: number; height: number };

export type PagePictureOptions = {
  /** The theme the PDF is printed in. */
  theme?: 'light' | 'dark';
  /** Reads the theme's variables; by default, the theme's own. */
  read?: ReadVariable;
  fonts: FontOptions;
  /** Highlighted code, by element id, when the Canvas is open. */
  codeRuns?: Record<string, Run[][]>;
  monoAdvance?: number;
};

/** The Canvas as a picture; null when it holds nothing. */
export async function pagePicture(scene: SceneData, options: PagePictureOptions): Promise<PagePicture | null> {
  // As read from its file, an attached arrow holds stored points, a
  // fallback: its ends are worked out from what it is attached to, as the
  // canvas does when it opens the page.
  const area = exportArea(produce(scene, (draft) => reroute(draft)), []);
  if (area.elements.length === 0) return null;
  const css = await fontCss(area.elements, options.fonts);
  const draw = (read: ReadVariable) => toSvg(area, { read, background: true, css, codeRuns: options.codeRuns, monoAdvance: options.monoAdvance });
  const svg = options.read ? draw(options.read) : withTheme(options.theme ?? 'light', draw);
  return { svg, width: area.box.w, height: area.box.h };
}
