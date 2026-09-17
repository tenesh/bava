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

const CONTROL = 'button, a[href], select, [role="button"], [role="menu"], [role="menuitem"], [role="radio"], [role="radiogroup"], [role="tab"], [role="toolbar"]';
const CONTROL_KEYS = new Set(['Enter', ' ', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/**
 * Whether a canvas keyboard shortcut must leave this key alone. A focused
 * control owns its activation and navigation keys (Enter and Space press a
 * button, arrows move within a menu or radio group), and a key something else
 * already handled is not the canvas's.
 */
export function canvasKeyStandsDown(target: Element | null, key: string, defaultPrevented: boolean): boolean {
  if (defaultPrevented) return true;
  return CONTROL_KEYS.has(key) && Boolean(target?.closest(CONTROL));
}
