// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import SpaceSettingsDialog from './SpaceSettingsDialog.svelte';

function setup(props: Record<string, unknown> = {}) {
  const handlers = { onSave: vi.fn(), onReveal: vi.fn(), onOpenChange: vi.fn() };
  const { app } = render(SpaceSettingsDialog, { open: true, name: 'Acme', root: '/Users/me/Acme', pageWidth: '', ...handlers, ...props } as never);
  return { app, handlers };
}

const field = () => document.querySelector<HTMLInputElement>('#space-name');
const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
const segment = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-part="item"]')].find((el) => (el.textContent ?? '').trim() === label);

function type(value: string) {
  field()!.value = value;
  field()!.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

describe('SpaceSettingsDialog', () => {
  it('holds the edits until Save, then applies each that changed', async () => {
    const { handlers } = setup();
    await vi.waitFor(() => expect(field()).not.toBeNull());
    type('  Acme Product  ');
    flushSync(() => segment('Wide')!.click());
    expect(handlers.onSave).not.toHaveBeenCalled();

    flushSync(() => button('Save')!.click());
    // One save with both, so the app can apply them one after the other.
    expect(handlers.onSave).toHaveBeenCalledWith({ name: 'Acme Product', width: 'wide' });
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('applies only what changed', async () => {
    const { handlers } = setup({ pageWidth: 'narrow' });
    await vi.waitFor(() => expect(field()).not.toBeNull());
    flushSync(() => segment('Your setting')!.click());
    flushSync(() => button('Save')!.click());
    expect(handlers.onSave).toHaveBeenCalledWith({ width: '' });
  });

  it('discards the edits on Cancel', async () => {
    const { handlers } = setup();
    await vi.waitFor(() => expect(field()).not.toBeNull());
    type('Something else');
    flushSync(() => segment('Full')!.click());
    flushSync(() => button('Cancel')!.click());
    expect(handlers.onSave).not.toHaveBeenCalled();
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the folder and reveals it', async () => {
    const { handlers } = setup();
    await vi.waitFor(() => expect(field()).not.toBeNull());
    expect(document.body.textContent).toContain('/Users/me/Acme');
    flushSync(() => button('Show in folder')!.click());
    expect(handlers.onReveal).toHaveBeenCalled();
  });
});
