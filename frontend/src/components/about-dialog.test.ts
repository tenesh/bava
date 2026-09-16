// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import AboutDialog from './AboutDialog.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('AboutDialog', () => {
  it('about shows the mark, wordmark and licence, and closes on Close', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const onOpenChange = vi.fn();
    const app = flushSync(() => mount(AboutDialog, { target, props: { open: true, onOpenChange } }));

    // Ark portals the content out of the component tree; wait for it.
    await vi.waitFor(() => expect(document.querySelector('.about')).not.toBeNull());
    const about = document.querySelector('.about')!;

    expect(about.querySelector('.mark')?.getAttribute('data-size')).toBe('about');
    expect(about.querySelector('.wordmark')?.textContent).toBe('bava');
    expect(about.textContent).toContain('Diagrams and documents, on your own disk.');
    expect(about.textContent).toContain('Apache-2.0');
    // Nothing is claimed that does not exist yet.
    expect(about.textContent).not.toMatch(/\d+\.\d+\.\d+/);

    const close = [...about.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Close');
    expect(close).toBeDefined();
    flushSync(() => close!.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);

    unmount(app);
  });
});
