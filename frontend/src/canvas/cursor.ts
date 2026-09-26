/**
 * The canvas cursor: one answer for what the pointer is over and what the app
 * is doing, as Excalidraw decides it (`App.tsx:8322-8555`). The pointer
 * handler says what is under the pointer (`cursorTarget`); this turns that
 * into a CSS cursor, and the app sets it on the canvas host on every move.
 */
import type { Handle } from './resize';
import type { ToolId } from './tools.svelte';

/** What is under the pointer, as far as the cursor is concerned. */
export type CursorTarget =
  | { kind: 'point' | 'middle' | 'segment' | 'focus' | 'rotate' | 'label' | 'confirm' }
  | { kind: 'resize'; handle: Handle; angle: number }
  | { kind: 'element'; movable: boolean };

export type CursorState = {
  tool: ToolId;
  over?: CursorTarget | null;
  /** Space held or the middle button down (`ready`), or the view being dragged (`moving`). */
  panning?: 'ready' | 'moving' | null;
  /** What a drag in progress holds, where that changes the cursor. */
  dragging?: 'label' | null;
};

/**
 * A turning arrow, as a cursor has no CSS keyword for it. Black on a white
 * outline, as the system's own cursors are drawn in either theme; its hot
 * spot is the middle.
 */
export const ROTATE_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 20 20'%3E" +
  "%3Cg fill='none' stroke-linecap='round' stroke-linejoin='round'%3E" +
  "%3Cpath d='M15.5 10a5.5 5.5 0 1 1-2-4.2M14 3v3.2h-3.2' stroke='white' stroke-width='4'/%3E" +
  "%3Cpath d='M15.5 10a5.5 5.5 0 1 1-2-4.2M14 3v3.2h-3.2' stroke='black' stroke-width='1.6'/%3E" +
  "%3C/g%3E%3C/svg%3E\") 10 10, auto";

/** The resize cursors a quarter-turn apart, starting with a handle straight up. */
const RESIZE = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'] as const;

/** Each handle's direction from the box's centre, in degrees clockwise from up. */
const HANDLE_ANGLE: Record<Handle, number> = {
  top: 0,
  'top-right': 45,
  right: 90,
  'bottom-right': 135,
  bottom: 180,
  'bottom-left': 225,
  left: 270,
  'top-left': 315,
};

export function cursorFor(state: CursorState): string {
  if (state.panning === 'moving') return 'grabbing';
  if (state.panning === 'ready') return 'grab';
  const over = state.over ?? null;
  if (state.tool === 'select') {
    if (state.dragging === 'label') return 'grabbing';
    if (!over) return 'default';
    switch (over.kind) {
      case 'point':
      case 'middle':
      case 'segment':
      case 'focus':
        return 'pointer';
      case 'resize': {
        // The handle's direction as drawn, to the nearest eighth of a turn.
        const eighth = Math.round((HANDLE_ANGLE[over.handle] + over.angle) / 45);
        return RESIZE[((eighth % 4) + 4) % 4];
      }
      case 'rotate':
        return ROTATE_CURSOR;
      case 'label':
        return 'grab';
      case 'element':
        return over.movable ? 'move' : 'default';
      default:
        return 'default';
    }
  }
  if (over?.kind === 'confirm') return 'pointer';
  return state.tool === 'text' ? 'text' : 'crosshair';
}
