// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import TrashDialog from './TrashDialog.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the Trash', () => {
  // Every row has the same two buttons; each names its item, so a screen
  // reader moving through them hears which page it would restore or delete.
  it('names the item on each row\'s Restore and Delete', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = flushSync(() =>
      mount(TrashDialog, {
        target,
        props: {
          open: true,
          items: [{ id: 'a1', path: 'Meeting notes/Q3 retro.md', kind: 'page', deletedAt: 'Today', size: '2 KB' }],
          total: '2 KB',
          onRestore: vi.fn(),
          onDelete: vi.fn(),
          onEmpty: vi.fn(),
          onOpenChange: vi.fn(),
        } as never,
      }),
    );
    await vi.waitFor(() => expect(document.querySelector('.item')).not.toBeNull());
    const labels = [...document.querySelectorAll('.item button')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Restore Q3 retro', 'Delete Q3 retro']);
    unmount(app);
  });
});
