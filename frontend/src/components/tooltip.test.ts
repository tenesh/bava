// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import TooltipHarness from './__fixtures__/TooltipHarness.svelte';

// Ark opens tooltips from real pointer events and from focus; binding `open`
// alone does not position them (design-system.md, measured behaviours).
describe('Tooltip', () => {
  function setup() {
    const { target } = render(TooltipHarness, { label: 'Rectangle', keys: 'R' });
    const trigger = target.querySelector('button')!;
    return { trigger };
  }

  const content = () => document.querySelector('[data-part="content"]:not([hidden])');

  it('names itself on hover, with its key', async () => {
    const { trigger } = setup();
    expect(trigger.textContent).toContain('trigger');
    trigger.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }));
    await vi.waitFor(() => expect(content()?.textContent).toContain('Rectangle'), { timeout: 2000 });
    expect(content()?.querySelector('kbd')?.textContent).toBe('R');
  });

  it('names itself on keyboard focus', async () => {
    const { trigger } = setup();
    // Ark opens on focus-visible only: a keyboard user arrives with Tab.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.focus();
    await vi.waitFor(() => expect(content()?.textContent).toContain('Rectangle'), { timeout: 2000 });
  });
});
