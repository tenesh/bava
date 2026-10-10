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

// The menu's owner gives the keys back its own way first (the page restores
// its selection with them); only when nothing took them does the menu put
// them back where they were.
describe('ContextMenu closing', () => {
  it('lets its owner take the keys first, refocusing nothing itself then', async () => {
    const before = document.createElement('input');
    const owner = document.createElement('button');
    document.body.append(before, owner);
    before.focus();
    const refocused = vi.fn();
    before.addEventListener('focus', refocused);
    const props = $state({ items, open: true, anchor: { x: 40, y: 60 }, onSelect: vi.fn(), onOpenChange: vi.fn(), onClosed: vi.fn(() => owner.focus()) });
    render(ContextMenu, props);
    await vi.waitFor(() => expect(content()).not.toBeNull());
    await vi.waitFor(() => expect(content().contains(document.activeElement)).toBe(true));
    props.open = false;
    flushSync();
    await vi.waitFor(() => expect(props.onClosed).toHaveBeenCalled());
    expect(document.activeElement).toBe(owner);
    expect(refocused).not.toHaveBeenCalled();
    before.remove();
    owner.remove();
  });

  it('puts the keys back where they were when its owner does not take them', async () => {
    const before = document.createElement('input');
    document.body.append(before);
    before.focus();
    const props = $state({ items, open: true, anchor: { x: 40, y: 60 }, onSelect: vi.fn(), onOpenChange: vi.fn(), onClosed: vi.fn() });
    render(ContextMenu, props);
    await vi.waitFor(() => expect(content()).not.toBeNull());
    await vi.waitFor(() => expect(content().contains(document.activeElement)).toBe(true));
    props.open = false;
    flushSync();
    await vi.waitFor(() => expect(props.onClosed).toHaveBeenCalled());
    expect(document.activeElement).toBe(before);
    before.remove();
  });
});
