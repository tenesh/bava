// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import LinkField from './LinkField.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

async function render(extra: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const props = { at: { left: 10, top: 40 }, value: 'old', onApply: vi.fn(), onRemove: vi.fn(), onCancel: vi.fn(), ...extra };
  mounted = flushSync(() => mount(LinkField, { target, props }));
  await vi.waitFor(() => expect(document.querySelector('.link-field input')).not.toBeNull());
  return { props, field: document.querySelector<HTMLInputElement>('.link-field input')! };
}

describe('LinkField', () => {
  it('closes, changing nothing, when the pointer goes down anywhere else', async () => {
    const { props, field } = await render();
    field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onCancel).not.toHaveBeenCalled();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('keeps what was typed instead, where the caller asks it to (a caption, a name)', async () => {
    const { props, field } = await render({ keepOnAway: true });
    field.value = 'new';
    flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onApply).toHaveBeenCalledWith('new');
  });
});
