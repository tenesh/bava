// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import { render } from '../test/render';
import DatePicker from './DatePicker.svelte';

async function setup(value = '2026-10-02') {
  const props = { at: { left: 10, bottom: 40 }, value, onPick: vi.fn(), onClose: vi.fn() };
  render(DatePicker, props);
  await vi.waitFor(() => expect(document.querySelector('.date-picker [data-value]')).not.toBeNull());
  return { props, panel: document.querySelector<HTMLElement>('.date-picker')! };
}

describe('DatePicker', () => {
  it("shows the chip's month, its day chosen", async () => {
    const { panel } = await setup();
    expect(panel.querySelector('.month')?.textContent?.trim()).toBe('October 2026');
    expect(panel.querySelector('[data-selected]')?.textContent?.trim()).toBe('2');
  });

  it('gives the day picked', async () => {
    const { panel, props } = await setup();
    const cell = [...panel.querySelectorAll<HTMLElement>('.day')].find((d) => d.textContent?.trim() === '15' && !d.hasAttribute('data-outside-range'))!;
    cell.click();
    await tick();
    expect(props.onPick).toHaveBeenCalledWith('2026-10-15');
  });

  it('moves a month on, and closes on Escape or a press outside it', async () => {
    const { panel, props } = await setup();
    panel.querySelector<HTMLButtonElement>('[aria-label="Next month"]')!.click();
    await vi.waitFor(() => expect(panel.querySelector('.month')?.textContent?.trim()).toBe('November 2026'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("puts focus on the chip's day, so the arrows move through the month", async () => {
    const { panel } = await setup();
    await vi.waitFor(() => expect(document.activeElement).toBe(panel.querySelector('[data-selected]')));
  });
});
