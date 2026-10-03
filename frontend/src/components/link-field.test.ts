// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import LinkField from './LinkField.svelte';

async function setup(extra: Record<string, unknown> = {}) {
  const props = { at: { left: 10, top: 40 }, value: 'old', onApply: vi.fn(), onRemove: vi.fn(), onCancel: vi.fn(), ...extra };
  render(LinkField, props);
  await vi.waitFor(() => expect(document.querySelector('.link-field input')).not.toBeNull());
  return { props, field: document.querySelector<HTMLInputElement>('.link-field input')! };
}

describe('LinkField', () => {
  it('closes, changing nothing, when the pointer goes down anywhere else', async () => {
    const { props, field } = await setup();
    field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onCancel).not.toHaveBeenCalled();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('keeps what was typed instead, where the caller asks it to (a caption, a name)', async () => {
    const { props, field } = await setup({ keepOnAway: true });
    field.value = 'new';
    flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onApply).toHaveBeenCalledWith('new');
  });

  it('sits above the selection by default, and on what it edits when asked', async () => {
    await setup();
    expect(document.querySelector<HTMLElement>('.link-field')!.style.top).toContain('var(--size-row-lg)');
    document.querySelector('.link-field')!.remove();
    await setup({ over: true });
    const top = document.querySelector<HTMLElement>('.link-field')!.style.top;
    expect(top).not.toContain('var(--size-row-lg)');
    expect(top).toContain('40px');
  });

  // A card's name has its size under it: a field no taller than the name's
  // line leaves that whole.
  it('over a line of a given height, is that tall, its text where the line\'s is', async () => {
    const { field } = await setup({ over: true, at: { left: 10, top: 40, height: 20 } });
    const form = document.querySelector<HTMLElement>('.link-field')!;
    expect(field.style.height).toBe('20px');
    expect(form.style.top).toBe('40px');
    expect(form.dataset.fit).toBe('line');
  });
});
