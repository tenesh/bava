// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import ConfirmDialog from './ConfirmDialog.svelte';

const OPTIONS = [
  { value: 'cancel', label: 'Cancel' },
  { value: 'remove', label: 'Remove', tone: 'primary' },
];

async function setup(extra: Record<string, unknown> = {}) {
  const onChoose = vi.fn();
  render(ConfirmDialog, { open: true, title: 'Remove Acme?', body: 'The folder stays.', options: OPTIONS, onChoose, ...extra } as never);
  await vi.waitFor(() => expect(document.querySelector('.options')).not.toBeNull());
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('.options button')].find((b) => b.textContent?.trim() === label)!;
  return { onChoose, button, input: () => document.querySelector<HTMLInputElement>('.bava-toggle input') };
}

describe('ConfirmDialog', () => {
  it('draws no switch unless asked', async () => {
    const { onChoose, button, input } = await setup();
    expect(input()).toBeNull();
    button('Remove').click();
    expect(onChoose).toHaveBeenCalledWith('remove', false);
  });

  it('starts its switch off, with its warning shown, and reports it with the choice', async () => {
    const { onChoose, button, input } = await setup({ check: { label: 'Also delete its data', hint: 'This cannot be undone.' } });
    expect(input()!.checked).toBe(false);
    expect(document.body.textContent).toContain('This cannot be undone.');
    button('Remove').click();
    expect(onChoose).toHaveBeenLastCalledWith('remove', false);
    flushSync(() => input()!.click());
    button('Remove').click();
    expect(onChoose).toHaveBeenLastCalledWith('remove', true);
  });
});

describe('an answer that cannot be undone', () => {
  it('is drawn in the danger colour, not the accent', async () => {
    render(ConfirmDialog, { open: true, title: 'Delete?', body: 'Gone for good.', options: [{ value: 'cancel', label: 'Cancel' }, { value: 'yes', label: 'Delete', tone: 'danger' }], onChoose: vi.fn() } as never);
    await vi.waitFor(() => expect(document.querySelector('.options')).not.toBeNull());
    const button = [...document.querySelectorAll<HTMLButtonElement>('.options button')].find((b) => b.textContent?.trim() === 'Delete')!;
    expect(button.classList.contains('danger')).toBe(true);
    expect(button.classList.contains('primary')).toBe(false);
  });
});
