// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '../test/render';
import Keycaps from './Keycaps.svelte';

describe('Keycaps', () => {
  it('draws one key box per key', () => {
    const { target } = render(Keycaps, { keys: '⇧⌘]' });
    expect([...target.querySelectorAll('kbd')].map((key) => key.textContent)).toEqual(['⇧', '⌘', ']']);
  });

  // A screen reader hears the shortcut once, not each box on its own.
  it('names the whole shortcut once', () => {
    const { target } = render(Keycaps, { keys: 'Ctrl+Shift+O' });
    const keys = target.querySelector('.keycaps')!;
    expect(keys.querySelector('.spoken')!.textContent).toBe('Ctrl+Shift+O');
    expect([...keys.querySelectorAll('kbd')].every((key) => key.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});
