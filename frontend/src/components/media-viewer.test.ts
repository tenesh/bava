// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import MediaViewer from './MediaViewer.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('MediaViewer', () => {
  it('shows the image over the app, named by its words, and closes with Escape', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const onOpenChange = vi.fn();
    const app = flushSync(() => mount(MediaViewer, { target, props: { open: true, src: '/bava-file/?path=a.png', alt: 'The logo', onOpenChange } }));

    await vi.waitFor(() => expect(document.querySelector('.media-viewer img')).not.toBeNull());
    const img = document.querySelector<HTMLImageElement>('.media-viewer img')!;
    expect(img.getAttribute('src')).toBe('/bava-file/?path=a.png');
    expect(img.alt).toBe('The logo');
    expect(document.querySelector('.bava-dialog-title')?.textContent).toBe('The logo');

    const content = document.querySelector<HTMLElement>('.bava-dialog-content')!;
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    unmount(app);
    // The dialog's deferred work (focus, closing) runs before the test ends,
    // so nothing it logs outlives the test on a slow machine.
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});
