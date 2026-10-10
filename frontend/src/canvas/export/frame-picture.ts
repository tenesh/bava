/**
 * A frame's picture, as a canvas embed shows it: the frame's own box, cut at
 * its edges, with everything drawn over it (frames inside it too), without
 * the frame's border or label, drawn at twice size on the canvas background.
 */
import type { SceneData, SceneElement } from '../scene';
import type { ExportArea } from './area';
import { drawnBoundsOf } from '../edit';
import { toPng, type PngOptions } from './png';

/** Pixels per scene unit: sharp on a high-resolution screen. */
export const PICTURE_SCALE = 2;

/**
 * What a frame's picture draws, and its box; null when there is no such
 * frame. Everything drawn over the frame's area, whether or not the frame
 * holds it: what crosses its edge is cut there when drawn.
 */
export function frameArea(scene: SceneData, frameId: string): ExportArea | null {
  const frame = scene.elements.find((element) => element.id === frameId && element.type === 'frame');
  if (!frame) return null;
  const box = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
  const overlaps = (element: SceneElement) => {
    const drawn = drawnBoundsOf([element]);
    return drawn.x < box.x + box.w && drawn.x + drawn.w > box.x && drawn.y < box.y + box.h && drawn.y + drawn.h > box.y;
  };
  const elements = scene.elements.filter((element) => element.id !== frameId && element.type !== 'group' && overlaps(element)).sort((a, b) => a.z - b.z);
  return { elements, box };
}

export type PictureOptions = Pick<PngOptions, 'theme' | 'read' | 'codeRuns'> & {
  /** Draws the area; `toPng` unless a test gives its own. */
  draw?: (area: ExportArea, options: PngOptions) => Promise<Blob>;
};

/** The frame's picture as a PNG; null when there is no such frame. */
export async function framePicture(scene: SceneData, frameId: string, options: PictureOptions): Promise<Blob | null> {
  const area = frameArea(scene, frameId);
  if (!area) return null;
  const { draw = toPng, ...rest } = options;
  return draw(area, { ...rest, scale: PICTURE_SCALE, background: true });
}
