/**
 * The single portal root.
 *
 * Ark renders dialogs, popovers, menus and tooltips outside the component tree,
 * and **ships no z-index of its own**. Spiked 2026-09-16, its content painted
 * below a plain `position: fixed; z-index: 9999` element. So the stacking is
 * ours to supply, once, here. A second portal root would mean two answers to
 * the same question.
 */
export const PORTAL_ROOT_ID = 'bava-portal-root';

/** Returns the portal root, creating it on first use. */
export function portalRoot(): HTMLElement {
  const existing = document.getElementById(PORTAL_ROOT_ID);
  if (existing) return existing;

  const root = document.createElement('div');
  root.id = PORTAL_ROOT_ID;
  document.body.append(root);
  return root;
}
