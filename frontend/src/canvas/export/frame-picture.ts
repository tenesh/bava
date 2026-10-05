/**
 * A frame's picture, as a canvas embed shows it: the frame's own box, cut at
 * its edges, holding what the frame holds (frames inside it too), without
 * the frame's border or label, drawn at twice size on the canvas background.
 */
import type { SceneData, SceneElement } from '../scene';
import type { ExportArea } from './area';
import { toPng, type PngOptions } from './png';

/** Pixels per scene unit: sharp on a high-resolution screen. */
const SCALE = 2;

/** What a frame's picture draws, and its box; null when there is no such frame. */
export function frameArea(scene: SceneData, frameId: string): ExportArea | null {
  const frame = scene.elements.find((element) => element.id === frameId && element.type === 'frame');
  if (!frame) return null;
  const byId = new Map(scene.elements.map((element) => [element.id, element]));
  // Held through any frame inside it, however deep; a loop in the file ends the walk.
  const heldBy = (element: SceneElement): boolean => {
    const seen = new Set<string>();
    for (let owner = element.frame; owner !== undefined && !seen.has(owner); owner = byId.get(owner)?.frame) {
      if (owner === frameId) return true;
      seen.add(owner);
    }
    return false;
  };
  const elements = scene.elements.filter((element) => element.type !== 'group' && heldBy(element)).sort((a, b) => a.z - b.z);
  return { elements, box: { x: frame.x, y: frame.y, w: frame.w, h: frame.h } };
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
  return draw(area, { ...rest, scale: SCALE, background: true });
}
