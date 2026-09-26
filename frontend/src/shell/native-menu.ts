/**
 * Whether a right-click keeps the webview's own context menu.
 *
 * Bava opens its own menu on the canvas; everywhere else the webview would
 * show its menu, and in a dev build Wails always lets it through, Reload and
 * all, which reloads the page and loses unsaved work. Only where there is
 * text to cut, copy or paste does the webview's menu earn its place: a text
 * field, and an editable area (the code and document editors, a label being
 * typed).
 */
const TEXT_INPUTS = new Set(['text', 'search', 'url', 'email', 'password', 'number', 'tel']);

export function keepsBrowserMenu(target: Element | null, selection: Selection | null = globalThis.getSelection?.() ?? null): boolean {
  if (!target) return false;
  // Text the user has selected, anywhere (the About dialog, a setting's
  // description), keeps Copy.
  if (selection && !selection.isCollapsed && selection.toString().length > 0) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUTS.has(target.type);
  // Inside an editable area, at any depth (a code line, a paragraph).
  return target.closest('[contenteditable]:not([contenteditable="false"])') !== null;
}
