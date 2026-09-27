// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import EmojiPicker from './EmojiPicker.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

const EMOJIS = [
  { emoji: '😀', name: 'grinning face', group: 'smileys_emotion' },
  { emoji: '😄', name: 'grinning face with smiling eyes', group: 'smileys_emotion' },
  { emoji: '🚀', name: 'rocket', group: 'travel_places' },
];

async function render() {
  const target = document.createElement('div');
  document.body.append(target);
  const props = {
    at: { left: 10, top: 40, bottom: 60 },
    emojis: EMOJIS,
    groupLabel: (slug: string) => `Group ${slug}`,
    onPick: vi.fn(),
    onClose: vi.fn(),
  };
  mounted = flushSync(() => mount(EmojiPicker, { target, props }));
  await vi.waitFor(() => expect(document.querySelector('.emoji-picker input')).not.toBeNull());
  return { props, search: document.querySelector<HTMLInputElement>('.emoji-picker input')! };
}

const shown = () => [...document.querySelectorAll('.emoji-picker .emoji')].map((b) => b.textContent);

describe('EmojiPicker', () => {
  it('shows every emoji under its group, with the search focused', async () => {
    const { search } = await render();
    expect(shown()).toEqual(['😀', '😄', '🚀']);
    expect([...document.querySelectorAll('.emoji-picker h3')].map((h) => h.textContent)).toEqual(['Group smileys_emotion', 'Group travel_places']);
    expect(document.activeElement).toBe(search);
  });

  it('narrows to the names that match what is typed', async () => {
    const { search } = await render();
    search.value = 'rock';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(shown()).toEqual(['🚀']));
  });

  it('gives the emoji picked, and closes on Escape', async () => {
    const { props, search } = await render();
    document.querySelectorAll<HTMLButtonElement>('.emoji-picker .emoji')[2].click();
    expect(props.onPick).toHaveBeenCalledWith('🚀');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
