// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import ContextMenu from './ContextMenu.svelte';
import type { MenuNode } from '../canvas/context-menu';

const items: MenuNode[] = [
  { kind: 'item', id: 'edit.cut', label: 'Cut', keys: '⌘X' },
  { kind: 'separator' },
  {
    kind: 'submenu',
    id: 'canvas.arrange',
    label: 'Arrange',
    items: [{ kind: 'item', id: 'canvas.bringForward', label: 'Bring Forward', keys: '⌘]' }],
  },
];

function setup() {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  const { app } = render(ContextMenu, { items, open: true, anchor: { x: 40, y: 60 }, onSelect, onOpenChange });
  return { app, onSelect, onOpenChange };
}

const content = () => document.querySelector('[data-part="content"]:not([hidden])') as HTMLElement;
const key = (el: HTMLElement, k: string) => flushSync(() => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));

describe('ContextMenu', () => {
  it('shows items with their keys, separators between groups, and a chevron on a submenu', async () => {
    setup();
    await vi.waitFor(() => expect(content()).not.toBeNull());
    expect(content().textContent).toContain('Cut');
    expect(content().querySelector('.keys .spoken')?.textContent).toBe('⌘X');
    expect([...content().querySelector('.keys')!.querySelectorAll('kbd')].map((key) => key.textContent)).toEqual(['⌘', 'X']);
    expect(content().querySelector('[data-part="separator"]')).not.toBeNull();
    const trigger = [...content().querySelectorAll('[data-part="trigger-item"]')].find((el) => el.textContent?.includes('Arrange'));
    expect(trigger?.querySelector('.chevron svg')).not.toBeNull();
  });

  it('reports the command chosen by keyboard', async () => {
    const { onSelect } = setup();
    await vi.waitFor(() => expect(content()).not.toBeNull());
    const menu = content();
    key(menu, 'ArrowDown');
    await vi.waitFor(() => expect(menu.querySelector('[data-highlighted]')?.textContent).toContain('Cut'));
    key(menu, 'Enter');
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith('edit.cut'));
  });

  it('opens a submenu by keyboard', async () => {
    setup();
    await vi.waitFor(() => expect(content()).not.toBeNull());
    const reopened = content();
    key(reopened, 'ArrowDown');
    key(reopened, 'ArrowDown');
    await vi.waitFor(() => expect(reopened.querySelector('[data-highlighted]')?.textContent).toContain('Arrange'));
    key(reopened, 'ArrowRight');
    await vi.waitFor(() => {
      const open = [...document.querySelectorAll('[data-part="content"]:not([hidden])')];
      expect(open.some((el) => el.textContent?.includes('Bring Forward'))).toBe(true);
    });
  });
});
