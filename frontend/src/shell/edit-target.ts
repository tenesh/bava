/**
 * Where an edit command goes.
 *
 * Undo, Redo, Select All and Delete come from the native menu as commands,
 * so the focused element, not the key event, decides who receives them.
 * The source editor keeps its own history; a text field keeps the browser's;
 * everything else is the canvas.
 */
export type EditTarget = 'source' | 'field' | 'canvas' | 'none';

/**
 * `canvasVisible` guards the fallback: with the canvas hidden, Select All
 * then Delete must not empty a canvas the user cannot see. Focus inside a
 * dialog never reaches the canvas behind it either.
 */
export function editTarget(focused: Element | null, context: { canvasVisible: boolean }): EditTarget {
  if (focused?.closest('.cm-editor')) return 'source';
  if (focused?.closest('input, textarea, [contenteditable]')) return 'field';
  if (focused?.closest('[role="dialog"], [role="alertdialog"]')) return 'none';
  return context.canvasVisible ? 'canvas' : 'none';
}

/** The selected text in a focused text field, for Copy and Cut. */
export function fieldSelection(focused: Element | null): string {
  if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
    const { selectionStart: start, selectionEnd: end, value } = focused;
    return start === null || end === null ? '' : value.slice(start, end);
  }
  return globalThis.getSelection?.()?.toString() ?? '';
}
