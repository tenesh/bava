// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import NewSpaceDialog from './NewSpaceDialog.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(location: string) {
  const target = document.createElement('div');
  document.body.append(target);
  const handlers = { onChooseLocation: vi.fn(), onCreate: vi.fn(), onOpenChange: vi.fn() };
  const app = flushSync(() => mount(NewSpaceDialog, { target, props: { open: true, location, ...handlers } }));
  return { app, handlers };
}

const field = () => document.querySelector<HTMLInputElement>('#new-space-name')!;
const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;

function type(value: string) {
  field().value = value;
  field().dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

describe('the New Space dialog', () => {
  it('asks for a name and a place, and creates only with both', async () => {
    const { app } = render('');
    await vi.waitFor(() => expect(field()).not.toBeNull());
    type('Acme');
    expect(button('Create').hasAttribute('disabled')).toBe(true);
    unmount(app);
    document.body.innerHTML = '';
    const again = render('/Users/me/Work');
    await vi.waitFor(() => expect(field()).not.toBeNull());
    type('  Acme  ');
    button('Create').click();
    expect(again.handlers.onCreate).toHaveBeenCalledWith('Acme');
    unmount(again.app);
  });

  it('shows where the folder will be made, and lets the user choose', async () => {
    const { app, handlers } = render('/Users/me/Work');
    await vi.waitFor(() => expect(field()).not.toBeNull());
    expect(document.body.textContent).toContain('/Users/me/Work');
    button('Choose').click();
    expect(handlers.onChooseLocation).toHaveBeenCalled();
    unmount(app);
  });
});
