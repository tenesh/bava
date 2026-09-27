// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import FormatBubble from './FormatBubble.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

function render(focus = 0) {
  const target = document.createElement('div');
  document.body.append(target);
  const props = $state({
    at: { left: 10, top: 40 },
    active: {},
    focus,
    onCommand: vi.fn(),
    onLeave: vi.fn(),
    onBlur: vi.fn(),
  });
  mounted = flushSync(() => mount(FormatBubble, { target, props }));
  const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('[role="toolbar"] button')];
  return { props, buttons };
}

/** Ark's portal places the toolbar after mounting. */
async function placed(buttons: () => HTMLButtonElement[]) {
  await vi.waitFor(() => expect(buttons().length).toBeGreaterThan(0));
}

describe('FormatBubble from the keyboard', () => {
  it('takes focus on its first button when asked, and not before', async () => {
    const { props, buttons } = render();
    await placed(buttons);
    expect(document.activeElement).not.toBe(buttons()[0]);
    flushSync(() => (props.focus = 1));
    expect(document.activeElement).toBe(buttons()[0]);
  });

  // Shown again after a command, it must not take focus back from the page.
  it('takes no focus when it appears with a request already made', async () => {
    const { buttons } = render(3);
    await placed(buttons);
    expect(document.activeElement).not.toBe(buttons()[0]);
  });

  it('moves between its buttons with the arrow keys, wrapping at the ends', async () => {
    const { props, buttons } = render();
    await placed(buttons);
    flushSync(() => (props.focus = 1));
    buttons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(buttons()[1]);
    buttons()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    buttons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(buttons().at(-1));
  });

  it('says when focus leaves it for somewhere else', async () => {
    const { props, buttons } = render();
    await placed(buttons);
    const outside = document.createElement('button');
    document.body.append(outside);
    flushSync(() => (props.focus = 1));
    outside.focus();
    expect(props.onBlur).toHaveBeenCalledTimes(1);
  });

  it('gives focus back on Escape', async () => {
    const { props, buttons } = render();
    await placed(buttons);
    flushSync(() => (props.focus = 1));
    buttons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(props.onLeave).toHaveBeenCalledTimes(1);
  });
});
