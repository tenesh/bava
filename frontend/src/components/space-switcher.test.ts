// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import SpaceSwitcher from './SpaceSwitcher.svelte';

describe('the Space switcher', () => {
  it('marks a recent Space it cannot open, still to be chosen', async () => {
    const onSelect = vi.fn();
    render(SpaceSwitcher, {
      name: 'Acme',
      root: '/Users/you/Acme',
      recents: [
        { path: '/Users/you/Acme', name: 'Acme' },
        { path: '/Users/you/Gone', name: 'Gone', missing: true },
      ],
      onSelect,
    });
    flushSync(() => document.querySelector<HTMLButtonElement>('.bava-space-switcher')!.click());
    const gone = await vi.waitFor(() => {
      const item = [...document.querySelectorAll<HTMLElement>('[data-part="item"]')].find((el) => el.textContent?.includes('Gone'));
      if (!item) throw new Error('no menu');
      return item;
    });
    expect(gone.textContent).toContain("Can't open");
    expect(gone.getAttribute('data-value')).toBe('recent:/Users/you/Gone');
    expect(gone.hasAttribute('data-disabled')).toBe(false);
  });
});
