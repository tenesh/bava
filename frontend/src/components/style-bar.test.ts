// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import StyleBar from './StyleBar.svelte';

function setup(props: Record<string, unknown>) {
  const onApply = vi.fn();
  const { target, app } = render(StyleBar, { fill: 'blue', stroke: null, color: 'mixed', onApply, ...props });
  return { target, app, onApply };
}

describe('StyleBar', () => {
  // A pen stroke has no fill: its picker is not offered, not offered-and-ignored.
  it('offers a picker only for keys the selection takes', () => {
    const { target } = setup({ fill: 'unavailable' });
    const labels = [...target.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Border colour', 'Text colour']);
  });

  it('applies a chosen swatch, and "default" clears it', async () => {
    const { target, onApply } = setup({});
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
  });
});

// The bar is a row of chips: the name is in the tooltip, not beside the chip.
describe('StyleBar chips', () => {
  it('shows the swatch alone, keeping the accessible name', () => {
    const { target } = setup({});
    const trigger = target.querySelector('button[aria-label="Fill colour"]') as HTMLElement;
    expect(trigger.textContent?.trim()).toBe('');
    expect(trigger.querySelector('.chip')).not.toBeNull();
    expect(target.querySelector('.trigger-label')).toBeNull();
  });

  it('names the chip in a tooltip on hover', async () => {
    const { target } = setup({});
    const trigger = target.querySelector('button[aria-label="Border colour"]') as HTMLElement;
    trigger.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse' }));
    await vi.waitFor(
      () => expect(document.querySelector('[data-part="content"]:not([hidden])')?.textContent).toContain('Border colour'),
      { timeout: 2000 },
    );
  });
});

// The chip is both the popover's trigger and the tooltip's. Spreading one
// machine's props over the other left the popover with no trigger element: it
// could not anchor its panel and the chip stopped opening it (seen at a
// running window; jsdom has no layout, so only the parts are observable).
describe('StyleBar chip wiring', () => {
  it('gives both machines the same trigger, by one id', () => {
    const { target } = setup({});
    const trigger = target.querySelector('button[aria-label="Fill colour"]') as HTMLElement;
    // One element, one id, addressable by both machines.
    expect(trigger.id).toBe('bava-style-fill-trigger');
    expect(document.getElementById(trigger.id)).toBe(trigger);
    // The popover's own attributes survived the merge with the tooltip's.
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-controls')).toMatch(/popover/);
  });

  it('names the chip on keyboard focus too', async () => {
    const { target } = setup({});
    const trigger = target.querySelector('button[aria-label="Fill colour"]') as HTMLElement;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    trigger.focus();
    await vi.waitFor(
      () => expect(document.querySelector('[data-part="content"]:not([hidden])')?.textContent).toContain('Fill colour'),
      { timeout: 2000 },
    );
  });
});

// A colour of the user's own, beside the swatches: stored as picked and
// adapted per theme.
describe('the colour picker', () => {
  it('offers a hex field beside the swatches and reports a literal colour', async () => {
    const { target, onApply } = setup({});
    flushSync(() => (target.querySelector('button[aria-label="Fill colour"]') as HTMLElement).click());
    await vi.waitFor(() => expect(document.querySelector('.bava-custom input')).not.toBeNull());

    const field = document.querySelector('.bava-custom input') as HTMLInputElement;
    field.value = '#e03131';
    flushSync(() => field.dispatchEvent(new Event('change', { bubbles: true })));
    await vi.waitFor(() => expect(onApply).toHaveBeenCalledWith('fill', '#e03131'));
  });

  it('ignores a malformed colour', async () => {
    const { target, onApply } = setup({});
    flushSync(() => (target.querySelector('button[aria-label="Fill colour"]') as HTMLElement).click());
    await vi.waitFor(() => expect(document.querySelector('.bava-custom input')).not.toBeNull());

    const field = document.querySelector('.bava-custom input') as HTMLInputElement;
    field.value = 'not a colour';
    flushSync(() => field.dispatchEvent(new Event('change', { bubbles: true })));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('shows a picked colour as the chip', () => {
    const { target } = setup({ fill: '#e03131' });
    const chip = target.querySelector('button[aria-label="Fill colour"] .chip') as HTMLElement;
    expect(chip.style.background).toContain('rgb(224, 49, 49)');
  });
});
