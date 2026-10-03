// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import MediaViewer from './MediaViewer.svelte';

describe('MediaViewer', () => {
  it('shows the image over the app, named by its words, and closes with Escape', async () => {
    const onOpenChange = vi.fn();
    render(MediaViewer, { open: true, src: '/bava-file/?path=a.png', alt: 'The logo', onOpenChange });

    await vi.waitFor(() => expect(document.querySelector('.media-viewer img')).not.toBeNull());
    const img = document.querySelector<HTMLImageElement>('.media-viewer img')!;
    expect(img.getAttribute('src')).toBe('/bava-file/?path=a.png');
    expect(img.alt).toBe('The logo');
    expect(document.querySelector('.bava-dialog-title')?.textContent).toBe('The logo');

    const content = document.querySelector<HTMLElement>('.bava-dialog-content')!;
    content.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
