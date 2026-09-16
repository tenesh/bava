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
  selectNext(): void;
  selectPrevious(): void;
  nudge(dx: number, dy: number): void;
  escape(): void;
  activateTool(tool: ToolId): void;
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
    case 'Tab':
      if (event.shiftKey) actions.selectPrevious();
      else actions.selectNext();
      return true;
    case 'Escape':
      actions.escape();
      return true;
    case 'ArrowLeft':
      actions.nudge(-1, 0);
      return true;
    case 'ArrowRight':
      actions.nudge(1, 0);
      return true;
    case 'ArrowUp':
      actions.nudge(0, -1);
      return true;
    case 'ArrowDown':
      actions.nudge(0, 1);
      return true;
    default:
      break;
  }

  const tool = toolForKey(event.key);
  if (tool) {
    actions.activateTool(tool);
    return true;
  }
  return false;
}
