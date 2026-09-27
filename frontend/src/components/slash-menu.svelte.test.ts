// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import SlashMenu from './SlashMenu.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

async function render(items: { id: string; label: string; group?: string }[]) {
  const target = document.createElement('div');
  document.body.append(target);
  mounted = flushSync(() => mount(SlashMenu, { target, props: { items, active: 0, at: { left: 0, bottom: 0 }, onChoose: vi.fn() } }));
  await vi.waitFor(() => expect(document.querySelector('.slash-menu')).not.toBeNull());
}

describe('SlashMenu', () => {
  it('labels each group once, in one list, with a divider between groups', async () => {
    await render([
      { id: 'a', label: 'Text', group: 'Basic' },
      { id: 'b', label: 'Heading 1', group: 'Basic' },
      { id: 'c', label: 'Callout', group: 'Advanced' },
    ]);
    expect([...document.querySelectorAll('.slash-group')].map((el) => el.textContent)).toEqual(['Basic', 'Advanced']);
    expect(document.querySelectorAll('.slash-menu [role="separator"]')).toHaveLength(1);
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(3);
  });

  it('shows no labels for items without a group', async () => {
    await render([{ id: 'a', label: '🚀 rocket' }]);
    expect(document.querySelector('.slash-group')).toBeNull();
  });
});
