/**
 * Canvas keyboard shortcuts.
 *
 * Pure: it takes an event and a set of actions and reports whether it handled
 * the key. The caller owns `preventDefault` and deciding what "typing" means.
 *
 * Everything here is ignored while a text field or the source editor has
 * focus. Without that, typing D2 deletes the selection and switches tools on
 * every keystroke.
 *
 * Nothing with Cmd or Ctrl is handled here. Those shortcuts belong to the
 * native menu (`internal/app/menu/spec.json`), which dispatches them as
 * commands; handling them here too would act twice per keypress.
 */
import { toolForKey, type ToolId } from './tools.svelte';

export type KeymapActions = {
  deleteSelection(): void;
  nudge(dx: number, dy: number): void;
  escape(): void;
  activateTool(tool: ToolId): void;
  /** Type into the selected shape's label or text. */
  editSelection(): void;
  /** Keep the drawing tool on after it draws, or stop keeping it (`Q`). */
  toggleLock(): void;
};

export function handleKey(
  event: KeyboardEvent,
  actions: KeymapActions,
  context: { typing: boolean },
): boolean {
  // The editor has its own history and its own text editing; the canvas keeps
  // out of the way entirely rather than trying to be clever about which keys.
  if (context.typing) return false;

  // The menu owns these, including the ones only a native role binds.
  if (event.metaKey || event.ctrlKey) return false;

  switch (event.key) {
    case 'Backspace':
    case 'Delete':
      actions.deleteSelection();
      return true;
    case 'Escape':
      actions.escape();
      return true;
    case 'Enter':
      actions.editSelection();
      return true;
    // One unit, or five with Shift, as Excalidraw steps.
    case 'ArrowLeft':
      actions.nudge(-nudgeStep(event), 0);
      return true;
    case 'ArrowRight':
      actions.nudge(nudgeStep(event), 0);
      return true;
    case 'ArrowUp':
      actions.nudge(0, -nudgeStep(event));
      return true;
    case 'ArrowDown':
      actions.nudge(0, nudgeStep(event));
      return true;
    default:
      break;
  }

  // A tool is its bare letter. Shift or Option with a letter is something
  // else: ⇧H flips.
  if (event.shiftKey || event.altKey) return false;
  if (event.key.toLowerCase() === 'q') {
    actions.toggleLock();
    return true;
  }
  const tool = toolForKey(event.key);
  if (tool) {
    actions.activateTool(tool);
    return true;
  }
  return false;
}

/**
 * How far an arrow key moves the selection, in scene units, and with Shift
 * held (Excalidraw's steps). Scene units, not a length on screen, so these are
 * constants rather than tokens.
 */
export const NUDGE_STEP = 1;
export const NUDGE_STEP_LARGE = 5;

function nudgeStep(event: KeyboardEvent): number {
  return event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
}
