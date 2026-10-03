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

// The dialog is modal, so a refusal told only in the status bar sat behind
// its backdrop: it is told beside the name, and the dialog stays.
describe('NewSpaceDialog refusing a name', () => {
  const refusal = 'A folder named Acme is already there.';

  async function refused() {
    const { handlers } = setup('/Users/me/Work');
    handlers.onCreate.mockResolvedValue(refusal);
    await vi.waitFor(() => expect(field()).not.toBeNull());
    type('Acme');
    button('Create').click();
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe(refusal));
    return handlers;
  }

  it('says why under the name and stays open', async () => {
    const handlers = await refused();
    expect(handlers.onOpenChange).not.toHaveBeenCalledWith(false);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(field().getAttribute('aria-describedby')).toBe(document.querySelector('[role="alert"]')!.id);
  });

  it('puts the keyboard back in the name', async () => {
    await refused();
    expect(document.activeElement).toBe(field());
  });

  it('drops the refusal once the name changes', async () => {
    await refused();
    type('Acme 2');
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(field().hasAttribute('aria-invalid')).toBe(false);
  });
});
