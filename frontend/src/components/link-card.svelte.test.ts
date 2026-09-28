// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import LinkCard from './LinkCard.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

async function render(extra: Partial<{ href: string; missing: boolean; relinkName: string | null; readOnly: boolean; focusFirst: boolean }> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const props = {
    at: { left: 10, bottom: 40 },
    href: '../Marketing/Launch%20plan.md#goals',
    missing: false,
    relinkName: null as string | null,
    onOpen: vi.fn(),
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onRelink: vi.fn(),
    onClose: vi.fn(),
    ...extra,
  };
  mounted = flushSync(() => mount(LinkCard, { target, props }));
  await vi.waitFor(() => expect(document.querySelector('.link-card')).not.toBeNull());
  const card = document.querySelector<HTMLElement>('.link-card')!;
  const button = (name: string) => [...card.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
  return { props, card, button };
}

describe('LinkCard', () => {
  it('shows the address as a person reads it, with Open, Edit and Remove', async () => {
    const { card, button, props } = await render();
    expect(card.querySelector('.address')?.textContent).toBe('../Marketing/Launch plan.md#goals');
    button('Open')!.click();
    button('Edit')!.click();
    button('Remove')!.click();
    expect([props.onOpen, props.onEdit, props.onRemove].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('says a missing page is missing, offers the page with its name, and no Open', async () => {
    const { card, button, props } = await render({ missing: true, relinkName: 'Launch plan' });
    expect(card.querySelector('.missing')?.textContent).toBe('Page not found');
    expect(button('Open')).toBeUndefined();
    button('Relink to Launch plan')!.click();
    expect(props.onRelink).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and on a press outside it, never on one inside', async () => {
    const { card, props } = await render();
    card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onClose).not.toHaveBeenCalled();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('on a locked page offers Open only', async () => {
    const { card } = await render({ readOnly: true });
    expect([...card.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual(['Open']);
  });

  it('takes focus when opened from the keyboard', async () => {
    const { button } = await render({ focusFirst: true });
    await vi.waitFor(() => expect(document.activeElement).toBe(button('Open')));
  });
});
