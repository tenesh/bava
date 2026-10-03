// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import OpacityPicker from './OpacityPicker.svelte';

function setup(props: Record<string, unknown> = {}) {
  const onSelect = vi.fn();
  const { target, app } = render(OpacityPicker, { current: 100, onSelect, ...props } as never);
  const trigger = target.querySelector('button')!;
  return { app, trigger, onSelect };
}

describe('OpacityPicker', () => {
  it('opens a slider showing the current value', async () => {
    const { trigger } = setup({ current: 40 });
    expect(trigger.getAttribute('aria-label')).toBe('Opacity');
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelector('[role="slider"]')).not.toBeNull());
    expect(document.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('40');
  });

  it('reports a change in steps of ten', async () => {
    const { trigger, onSelect } = setup({ current: 50 });
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelector('[role="slider"]')).not.toBeNull());
    const thumb = document.querySelector('[role="slider"]') as HTMLElement;
    thumb.focus();
    thumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(60));
  });

  it('starts a mixed selection at full', async () => {
    const { trigger } = setup({ current: 'mixed' });
    flushSync(() => trigger.click());
    await vi.waitFor(() => expect(document.querySelector('[role="slider"]')).not.toBeNull());
    expect(document.querySelector('[role="slider"]')?.getAttribute('aria-valuenow')).toBe('100');
  });
});
