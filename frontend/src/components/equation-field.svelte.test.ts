// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import EquationField from './EquationField.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

async function render(value = 'x^2') {
  const target = document.createElement('div');
  document.body.append(target);
  const props = {
    at: { left: 10, top: 40, bottom: 60 },
    value,
    display: true,
    render: vi.fn((tex: string, el: HTMLElement) => void (el.textContent = `drawn ${tex}`)),
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };
  mounted = flushSync(() => mount(EquationField, { target, props }));
  await vi.waitFor(() => expect(document.querySelector('textarea')).not.toBeNull());
  return { props, field: document.querySelector('textarea')! };
}

const press = (el: Element, key: string, shiftKey = false) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));

describe('EquationField', () => {
  it('opens with the TeX, focused, and draws it below', async () => {
    const { field } = await render('a + b');
    expect(field.value).toBe('a + b');
    expect(document.activeElement).toBe(field);
    await vi.waitFor(() => expect(document.querySelector('.equation-preview')?.textContent).toBe('drawn a + b'));
  });

  it('redraws as the TeX changes', async () => {
    const { field } = await render('a');
    field.value = 'a^2';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(document.querySelector('.equation-preview')?.textContent).toBe('drawn a^2'));
  });

  it('saves on Enter, keeps Shift+Enter for a new line, and cancels on Escape', async () => {
    const { props, field } = await render('k');
    press(field, 'Enter', true);
    expect(props.onSave).not.toHaveBeenCalled();
    press(field, 'Enter');
    expect(props.onSave).toHaveBeenCalledWith('k');
    press(field, 'Escape');
    expect(props.onCancel).toHaveBeenCalled();
  });

  it('keeps what was typed when the pointer goes down anywhere else', async () => {
    const { props, field } = await render('x^2');
    field.value = 'x^3';
    flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
    // Inside the field: nothing happens.
    field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onSave).not.toHaveBeenCalled();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onSave).toHaveBeenCalledWith('x^3');
  });
});
