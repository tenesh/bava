// @vitest-environment jsdom
// Runes, so the dialog can be closed the way the app closes it: by changing
// `open` on a mounted component. A `.svelte.ts` test file is compiled by the
// Svelte plugin (see vitest.config.ts).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import DiagramDialog from './DiagramDialog.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('closing the diagram dialog', () => {
  it('takes the editor away, and builds a new one on the next open', async () => {
    const state = $state({ open: true, source: 'first -> one' });
    const target = document.createElement('div');
    document.body.append(target);
    const app = flushSync(() =>
      mount(DiagramDialog, {
        target,
        props: {
          get open() {
            return state.open;
          },
          get source() {
            return state.source;
          },
          preview: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
          errors: [],
          onSource: vi.fn(),
          onInsert: vi.fn(),
          onOpenChange: vi.fn(),
        } as never,
      }),
    );

    await vi.waitFor(() => expect(document.querySelector('.cm-content')?.textContent).toContain('first'));

    flushSync(() => {
      state.open = false;
    });
    await vi.waitFor(() => expect(document.querySelector('.cm-editor')).toBeNull());

    flushSync(() => {
      state.source = 'second -> two';
      state.open = true;
    });
    await vi.waitFor(() => expect(document.querySelector('.cm-content')?.textContent).toContain('second'));

    unmount(app);
  });
});
