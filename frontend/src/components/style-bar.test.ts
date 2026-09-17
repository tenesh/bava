// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import StyleBar from './StyleBar.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.append(target);
  const onApply = vi.fn();
  const app = flushSync(() =>
    mount(StyleBar, { target, props: { fill: 'blue', stroke: null, color: 'mixed', onApply, ...props } }),
  );
  return { target, app, onApply };
}

describe('StyleBar', () => {
  // A pen stroke has no fill: its picker is not offered, not offered-and-ignored.
  it('offers a picker only for keys the selection takes', () => {
    const { target, app } = render({ fill: 'unavailable' });
    const labels = [...target.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Border colour', 'Text colour']);
    unmount(app);
  });

  it('applies a chosen swatch, and "default" clears it', async () => {
    const { target, app, onApply } = render({});
    flushSync(() => (target.querySelector('button[aria-label="Fill colour"]') as HTMLElement).click());
    await vi.waitFor(() => expect(document.querySelectorAll('[data-part="item"][data-scope="radio-group"]').length).toBe(9));

    const item = (name: string) =>
      [...document.querySelectorAll('[data-part="item"][data-scope="radio-group"]')].find(
        (el) => el.textContent?.trim() === name,
      ) as HTMLElement;
    flushSync(() => item('Red').click());
    await vi.waitFor(() => expect(onApply).toHaveBeenCalledWith('fill', 'red'));

    flushSync(() => item('Default').click());
    await vi.waitFor(() => expect(onApply).toHaveBeenCalledWith('fill', null));
    unmount(app);
  });
});
