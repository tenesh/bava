/**
 * A diagram made from the page, placed in a frame of its own below what the
 * canvas already holds, so the page can embed that frame.
 */
import type { SceneData, SceneElement } from '../scene';
import { boundsOf, drawnBoundsOf } from '../edit';

/** Room between the diagram and its frame's edge. */
export const DIAGRAM_FRAME_PADDING = 40;
/** Room between what the canvas holds and the new frame. */
export const DIAGRAM_FRAME_GAP = 80;

/**
 * The diagram's elements moved below the scene's content, at its left edge,
 * after a new frame labelled `label` that holds them: the frame first, so it
 * is drawn behind them.
 */
export function inNewFrame(scene: SceneData, diagram: SceneElement[], label: string): SceneElement[] {
  const inside = boundsOf(diagram);
  const content = scene.elements.length > 0 ? drawnBoundsOf(scene.elements) : null;
  const frameAt = content ? { x: content.x, y: content.y + content.h + DIAGRAM_FRAME_GAP } : { x: 0, y: 0 };
  const dx = frameAt.x + DIAGRAM_FRAME_PADDING - inside.x;
  const dy = frameAt.y + DIAGRAM_FRAME_PADDING - inside.y;
  const ids = new Set(scene.elements.map((element) => element.id));
  let id = 'diagram';
  for (let n = 2; ids.has(id) || diagram.some((element) => element.id === id); n += 1) id = `diagram-${n}`;
  const frame = {
    id,
    type: 'frame',
    ...frameAt,
    w: inside.w + 2 * DIAGRAM_FRAME_PADDING,
    h: inside.h + 2 * DIAGRAM_FRAME_PADDING,
    z: 0,
    label,
  } as SceneElement;
  return [frame, ...diagram.map((element) => ({ ...element, x: element.x + dx, y: element.y + dy, frame: element.frame ?? id }) as SceneElement)];
}
