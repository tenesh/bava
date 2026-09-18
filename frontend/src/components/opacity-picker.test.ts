// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import OpacityPicker from './OpacityPicker.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const onSelect = vi.fn();
  const app = flushSync(() => mount(OpacityPicker, { target, props: { current: 100, onSelect, ...props } as never }));
  const trigger = target.querySelector('button')!;
  return { app, trigger, onSelect };
}

describe('OpacityPicker', () => {
  it('opens a slider showing the current value', async () => {
    const { app, trigger } = render({ current: 40 });
    expect(trigger.getAttribute('aria-label')).toBe('Opacity');
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelector('[role="slider"]')).not.toBeNull());
    expect(document.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('40');
    unmount(app);
  });

  it('reports a change in steps of ten', async () => {
    const { app, trigger, onSelect } = render({ current: 50 });
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelector('[role="slider"]')).not.toBeNull());
    const thumb = document.querySelector('[role="slider"]') as HTMLElement;
    thumb.focus();
    thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(60));
    unmount(app);
  });

  it('starts a mixed selection at full', async () => {
    const { app, trigger } = render({ current: 'mixed' });
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelector('[role="slider"]')).not.toBeNull());
    expect(document.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('100');
    unmount(app);
  });
});
