// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Toggle from './Toggle.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const onChange = vi.fn();
  const app = flushSync(() =>
    mount(Toggle, { target, props: { label: 'Background', checked: false, onChange, ...props } as never }),
  );
  const input = target.querySelector('input')!;
  return { app, target, input, onChange };
}

describe('Toggle', () => {
  it('is a labelled checkbox reporting what it was switched to', () => {
    const { app, target, input, onChange } = render();
    expect(target.textContent).toContain('Background');
    expect(input.checked).toBe(false);
    flushSync(() => input.click());
    expect(onChange).toHaveBeenCalledWith(true);
    unmount(app);
  });

  it('shows the state it is given', () => {
    const { app, input } = render({ checked: true });
    expect(input.checked).toBe(true);
    unmount(app);
  });

  // A disabled toggle explains itself by staying visible rather than vanishing:
  // Only selected is disabled when nothing is selected.
  it('can be disabled, and then reports nothing', () => {
    const { app, input, onChange } = render({ disabled: true });
    expect(input.disabled).toBe(true);
    flushSync(() => input.click());
    expect(onChange).not.toHaveBeenCalled();
    unmount(app);
  });
});
