// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import NewSpaceDialog from './NewSpaceDialog.svelte';

function setup(location: string) {
  const handlers = { onChooseLocation: vi.fn(), onCreate: vi.fn(), onOpenChange: vi.fn() };
  const { app } = render(NewSpaceDialog, { open: true, location, ...handlers });
  return { app, handlers };
}

const field = () => document.querySelector<HTMLInputElement>('#new-space-name')!;
const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;

function type(value: string) {
  field().value = value;
  field().dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

describe('NewSpaceDialog', () => {
  it('cannot create without a place', async () => {
    setup('');
    await vi.waitFor(() => expect(field()).not.toBeNull());
    type('Acme');
    expect(button('Create').hasAttribute('disabled')).toBe(true);
  });

  it('creates with a name and a place, the name trimmed', async () => {
    const again = setup('/Users/me/Work');
    await vi.waitFor(() => expect(field()).not.toBeNull());
    type('  Acme  ');
    button('Create').click();
    expect(again.handlers.onCreate).toHaveBeenCalledWith('Acme');
  });

  it('shows where the folder will be made, and lets the user choose', async () => {
    const { handlers } = setup('/Users/me/Work');
    await vi.waitFor(() => expect(field()).not.toBeNull());
    expect(document.body.textContent).toContain('/Users/me/Work');
    button('Choose').click();
    expect(handlers.onChooseLocation).toHaveBeenCalled();
  });
});
