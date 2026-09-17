// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import SelectionToolbar from './SelectionToolbar.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.append(target);
  const onApply = vi.fn();
  const onCommand = vi.fn();
  const onMore = vi.fn();
  const app = flushSync(() =>
    mount(SelectionToolbar, {
      target,
      props: {
        styles: { fill: null, stroke: 'blue', color: 'unavailable' },
        align: false,
        distribute: false,
        onApply,
        onCommand,
        onMore,
        ...props,
      } as never,
    }),
  );
  const button = (name: string) => [...target.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === name);
  return { app, target, button, onApply, onCommand, onMore };
}

describe('SelectionToolbar', () => {
  it('shows the colour pickers that apply and More, without align for one unit', () => {
    const { app, button } = render({});
    expect(button('Fill colour')).toBeDefined();
    expect(button('Border colour')).toBeDefined();
    expect(button('Text colour')).toBeUndefined();
    expect(button('Align left')).toBeUndefined();
    expect(button('More actions')).toBeDefined();
    unmount(app);
  });

  it('shows align buttons for two units and distribute for three, reporting the command', () => {
    const two = render({ align: true });
    expect(two.button('Distribute horizontally')).toBeUndefined();
    two.button('Align left')!.click();
    expect(two.onCommand).toHaveBeenCalledWith('canvas.alignLeft');
    unmount(two.app);

    const three = render({ align: true, distribute: true });
    three.button('Distribute vertically')!.click();
    expect(three.onCommand).toHaveBeenCalledWith('canvas.distributeVertical');
    unmount(three.app);
  });

  it('reports More with where it is, so the menu can open there', () => {
    const { app, button, onMore } = render({});
    button('More actions')!.click();
    expect(onMore).toHaveBeenCalledWith(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    unmount(app);
  });
});
