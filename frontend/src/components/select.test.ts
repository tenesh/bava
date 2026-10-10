// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import Select from './Select.svelte';

const OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'date', label: 'Date' },
];

function setup(extra: Record<string, unknown> = {}) {
  const props = { label: 'Sort by', value: 'name', options: OPTIONS, prefix: 'Sort:', onValueChange: vi.fn(), ...extra };
  render(Select, props as never);
  return props;
}

const trigger = () => document.querySelector<HTMLButtonElement>('.bava-select-trigger')!;

describe('Select', () => {
  it('shows the chosen option after its prefix', () => {
    setup();
    expect(trigger().textContent?.replace(/\s+/g, ' ').trim()).toBe('Sort: Name');
  });

  it('is named by a label, hidden from sight, that names its trigger too', () => {
    setup();
    const ids = trigger().getAttribute('aria-labelledby')?.split(' ') ?? [];
    const names = ids.map((id) => document.getElementById(id)?.textContent?.trim());
    expect(names).toContain('Sort by');
    expect(trigger().hasAttribute('aria-label')).toBe(false);
  });

  it('shows a choice made by its caller', () => {
    setup({ value: 'size', prefix: undefined });
    expect(trigger().textContent?.trim()).toBe('Size');
  });

  it('reports the option picked from its list', async () => {
    const props = setup();
    flushSync(() => trigger().click());
    const option = await vi.waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('.bava-select-item')].find((item) => item.textContent?.trim() === 'Size');
      if (!found) throw new Error('no list');
      return found;
    });
    flushSync(() => option.click());
    expect(props.onValueChange).toHaveBeenCalledWith('size');
  });
});
