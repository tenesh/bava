// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import BlockHandle from './BlockHandle.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

function render() {
  const target = document.createElement('div');
  document.body.append(target);
  const props = { at: { left: 0, top: 0 }, alt: '⌥', onAdd: vi.fn(), onMenu: vi.fn(), onDragStart: vi.fn(), onDragEnd: vi.fn() };
  mounted = flushSync(() => mount(BlockHandle, { target, props }));
  return { props, add: target.querySelector<HTMLButtonElement>('button')! };
}

describe('BlockHandle', () => {
  it("adds a block after, or before with ⌥, and says so in the +'s tip", () => {
    const { props, add } = render();
    add.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    add.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
    expect(props.onAdd.mock.calls).toEqual([[false], [true]]);
    expect(add.title).toBe('Add a block after. ⌥-click to add one before');
  });
});
