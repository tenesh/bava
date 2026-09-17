// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import TooltipHarness from './fixtures/TooltipHarness.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

// Ark opens tooltips from real pointer events and from focus; binding `open`
// alone does not position them (design-system.md, measured behaviours).
describe('Tooltip', () => {
  function render() {
    const target = document.createElement('div');
    document.body.append(target);
    const app = flushSync(() => mount(TooltipHarness, { target, props: { label: 'Rectangle', keys: 'R' } }));
    const trigger = target.querySelector('button')!;
    return { app, trigger };
  }

  const content = () => document.querySelector('[data-part="content"]:not([hidden])');

  it('names itself on hover, with its key', async () => {
    const { app, trigger } = render();
    expect(trigger.textContent).toContain('trigger');
    trigger.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }));
    await vi.waitFor(() => expect(content()?.textContent).toContain('Rectangle'), { timeout: 2000 });
    expect(content()?.querySelector('kbd')?.textContent).toBe('R');
    unmount(app);
  });

  it('names itself on keyboard focus', async () => {
    const { app, trigger } = render();
    // Ark opens on focus-visible only: a keyboard user arrives with Tab.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.focus();
    await vi.waitFor(() => expect(content()?.textContent).toContain('Rectangle'), { timeout: 2000 });
    unmount(app);
  });
});
