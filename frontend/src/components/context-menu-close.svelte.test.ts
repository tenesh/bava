// @vitest-environment jsdom
// Runes, so the menu can be closed the way the app closes it: by changing
// `open` on a mounted component.
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import ContextMenu from './ContextMenu.svelte';

const content = () => document.querySelector('[data-part="content"]');

describe('ContextMenu', () => {
  // Focus given back while the menu is still in the page can be taken by it
  // again, and lost to the page's body when it leaves: the caller hands focus
  // back once the menu is gone.
  it('reports that it has closed only once it has left the page', async () => {
    const state = $state({ open: true });
    let leftPage: boolean | null = null;
    const onClosed = vi.fn(() => (leftPage = content() === null));
    render(ContextMenu, {
      get open() {
        return state.open;
      },
      items: [{ kind: 'item', id: 'edit.cut', label: 'Cut' }],
      anchor: { x: 40, y: 60 },
      onSelect: vi.fn(),
      onOpenChange: vi.fn(),
      onClosed,
    } as never);
    await vi.waitFor(() => expect(content()).not.toBeNull());
    expect(onClosed).not.toHaveBeenCalled();

    flushSync(() => {
      state.open = false;
    });
    await vi.waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(leftPage).toBe(true);
  });
});
