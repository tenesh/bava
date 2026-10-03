// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import AboutDialog from './AboutDialog.svelte';

describe('AboutDialog', () => {
  it('closes on Close', async () => {
    const onOpenChange = vi.fn();
    render(AboutDialog, { open: true, onOpenChange });

    // Ark portals the content out of the component tree; wait for it.
    await vi.waitFor(() => expect(document.querySelector('.about')).not.toBeNull());
    const close = [...document.querySelectorAll<HTMLButtonElement>('.about button')].find((b) => b.textContent?.trim() === 'Close');
    expect(close).toBeDefined();
    flushSync(() => close!.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
