// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import SaveTemplateDialog from './SaveTemplateDialog.svelte';

async function setup(extra: Record<string, unknown> = {}) {
  const props = { open: true, name: 'Launch plan', groups: ['Design', 'Meetings'], refusal: null, onSave: vi.fn(), onOpenChange: vi.fn(), ...extra };
  render(SaveTemplateDialog, props as never);
  await vi.waitFor(() => expect(document.querySelector('#template-name')).not.toBeNull());
  return props;
}

const field = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!;
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === label)!;
const type = (input: HTMLInputElement, text: string) => {
  input.value = text;
  flushSync(() => input.dispatchEvent(new Event('input', { bubbles: true })));
};

describe('SaveTemplateDialog', () => {
  it('starts with the page\'s name and no group, and saves them', async () => {
    const props = await setup();
    expect(field('template-name').value).toBe('Launch plan');
    expect(field('template-group').value).toBe('');
    button('Save').click();
    expect(props.onSave).toHaveBeenCalledWith('Launch plan', '');
  });

  it('puts an existing group in with a click, or takes a new one typed', async () => {
    const props = await setup();
    flushSync(() => button('Meetings').click());
    expect(field('template-group').value).toBe('Meetings');
    type(field('template-group'), 'Rituals');
    button('Save').click();
    expect(props.onSave).toHaveBeenCalledWith('Launch plan', 'Rituals');
  });

  it('cannot save without a name', async () => {
    await setup();
    type(field('template-name'), '  ');
    expect(button('Save').disabled).toBe(true);
  });

  it('shows why a name was refused', async () => {
    await setup({ refusal: 'A name cannot hold / or \\\\' });
    expect(document.querySelector('[role="alert"]')!.textContent).toContain('A name cannot hold');
  });
});
