// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import SlashMenu from './SlashMenu.svelte';

async function setup(items: { id: string; label: string; group?: string }[]) {
  render(SlashMenu, { items, active: 0, at: { left: 0, bottom: 0 }, onChoose: vi.fn() });
  await vi.waitFor(() => expect(document.querySelector('.slash-menu')).not.toBeNull());
}

describe('SlashMenu', () => {
  it('labels each group once, in one list, with a divider between groups', async () => {
    await setup([
      { id: 'a', label: 'Text', group: 'Basic' },
      { id: 'b', label: 'Heading 1', group: 'Basic' },
      { id: 'c', label: 'Callout', group: 'Advanced' },
    ]);
    expect([...document.querySelectorAll('.slash-group')].map((el) => el.textContent)).toEqual(['Basic', 'Advanced']);
    expect(document.querySelectorAll('.slash-menu [role="separator"]')).toHaveLength(1);
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(3);
  });

  it('shows no labels for items without a group', async () => {
    await setup([{ id: 'a', label: '🚀 rocket' }]);
    expect(document.querySelector('.slash-group')).toBeNull();
  });
});
