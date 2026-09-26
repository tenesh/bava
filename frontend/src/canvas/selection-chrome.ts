/**
 * What a selection shows: its outline, which resize handles, and the rotate
 * handle. One answer for the stage that draws them and the pointer that
 * presses them, so a handle is never drawn without working or the reverse.
 *
 * As Excalidraw (`transformHandles.ts:328-354`): one straight (two-point)
 * line or arrow, or one elbow arrow, shows no box at all, only its points; one
 * bent line or arrow shows the box with its four corners and the rotate
 * handle; anything else shows the box, all eight handles and, if it can turn,
 * the rotate handle.
 */
import { HANDLES, type Handle } from './resize';
import { canRotate } from './rotate';
import type { SceneElement } from './scene';

export type Chrome = { box: boolean; handles: readonly Handle[]; rotate: boolean };

const CORNERS: readonly Handle[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];

/**
 * A code block's height is its code's (`docs/file-format.md`, "Code blocks"),
 * so it takes no top or bottom handle, nor a top corner, which would move its
 * top while its height snaps back.
 */
const CODE_HANDLES: readonly Handle[] = ['left', 'right', 'bottom-right', 'bottom-left'];

export function chromeFor(selected: SceneElement[]): Chrome {
  if (selected.length > 0 && selected.every((element) => element.type === 'code')) {
    return { box: true, handles: CODE_HANDLES, rotate: selected.some((e) => canRotate(e as { type: string; arrowType?: string })) };
  }
  if (selected.length === 1 && (selected[0].type === 'line' || selected[0].type === 'arrow')) {
    const element = selected[0];
    const points = ('points' in element ? element.points : []) as number[];
    const elbow = element.type === 'arrow' && (element as { arrowType?: string }).arrowType === 'elbow';
    if (elbow || points.length <= 4) return { box: false, handles: [], rotate: false };
    return { box: true, handles: CORNERS, rotate: true };
  }
  return { box: true, handles: HANDLES, rotate: selected.some((e) => canRotate(e as { type: string; arrowType?: string })) };
}
