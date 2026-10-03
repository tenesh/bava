// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import BlockHandle from './BlockHandle.svelte';

function setup() {
  const props = { at: { left: 0, top: 0 }, alt: '⌥', onAdd: vi.fn(), onMenu: vi.fn(), onDragStart: vi.fn(), onDragEnd: vi.fn() };
  const { target } = render(BlockHandle, props);
  return { props, add: target.querySelector<HTMLButtonElement>('button')! };
}

describe('BlockHandle', () => {
  it("adds a block after, or before with ⌥, and says so in the +'s tip", () => {
    const { props, add } = setup();
    add.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    add.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true }));
    expect(props.onAdd.mock.calls).toEqual([[false], [true]]);
    expect(add.title).toBe('Add a block after. ⌥-click to add one before');
  });
});
