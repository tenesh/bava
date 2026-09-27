// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import SpaceSettingsDialog from './SpaceSettingsDialog.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const handlers = { onSave: vi.fn(), onReveal: vi.fn(), onOpenChange: vi.fn() };
  const app = flushSync(() =>
    mount(SpaceSettingsDialog, {
      target,
      props: { open: true, name: 'Acme', root: '/Users/me/Acme', pageWidth: '', ...handlers, ...props } as never,
    }),
  );
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

describe('the Space settings dialog', () => {
  it('holds the edits until Save, then applies each that changed', async () => {
    const { app, handlers } = render();
    await vi.waitFor(() => expect(field()).not.toBeNull());
    type('  Acme Product  ');
    flushSync(() => segment('Wide')!.click());
    expect(handlers.onSave).not.toHaveBeenCalled();

    flushSync(() => button('Save')!.click());
    // One save with both, so the app can apply them one after the other.
    expect(handlers.onSave).toHaveBeenCalledWith({ name: 'Acme Product', width: 'wide' });
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
    unmount(app);
  });

  it('applies only what changed', async () => {
    const { app, handlers } = render({ pageWidth: 'narrow' });
    await vi.waitFor(() => expect(field()).not.toBeNull());
    flushSync(() => segment('Your setting')!.click());
    flushSync(() => button('Save')!.click());
    expect(handlers.onSave).toHaveBeenCalledWith({ width: '' });
    unmount(app);
  });

  it('discards the edits on Cancel', async () => {
    const { app, handlers } = render();
    await vi.waitFor(() => expect(field()).not.toBeNull());
    type('Something else');
    flushSync(() => segment('Full')!.click());
    flushSync(() => button('Cancel')!.click());
    expect(handlers.onSave).not.toHaveBeenCalled();
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
    unmount(app);
  });

  it('shows the folder and reveals it', async () => {
    const { app, handlers } = render();
    await vi.waitFor(() => expect(field()).not.toBeNull());
    expect(document.body.textContent).toContain('/Users/me/Acme');
    flushSync(() => button('Show in folder')!.click());
    expect(handlers.onReveal).toHaveBeenCalled();
    unmount(app);
  });
});
