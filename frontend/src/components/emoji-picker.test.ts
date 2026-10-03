// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import EmojiPicker from './EmojiPicker.svelte';

const EMOJIS = [
  { emoji: '😀', name: 'grinning face', group: 'smileys_emotion' },
  { emoji: '😄', name: 'grinning face with smiling eyes', group: 'smileys_emotion' },
  { emoji: '🚀', name: 'rocket', group: 'travel_places' },
];

async function setup(emojis = EMOJIS) {
  const props = {
    at: { left: 10, top: 40, bottom: 60 },
    emojis,
    groupLabel: (slug: string) => `Group ${slug}`,
    onPick: vi.fn(),
    onClose: vi.fn(),
  };
  render(EmojiPicker, props);
  await vi.waitFor(() => expect(document.querySelector('.emoji-picker input')).not.toBeNull());
  return { props, search: document.querySelector<HTMLInputElement>('.emoji-picker input')! };
}

const shown = () => [...document.querySelectorAll('.emoji-picker .emoji')].map((b) => b.textContent);

describe('EmojiPicker', () => {
  it('shows every emoji under its group, with the search focused', async () => {
    const { search } = await setup();
    expect(shown()).toEqual(['😀', '😄', '🚀']);
    expect([...document.querySelectorAll('.emoji-picker h3')].map((h) => h.textContent)).toEqual(['Group smileys_emotion', 'Group travel_places']);
    expect(document.activeElement).toBe(search);
  });

  it('narrows to the names that match what is typed', async () => {
    const { search } = await setup();
    search.value = 'rock';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(shown()).toEqual(['🚀']));
  });

  it('gives the emoji picked, and closes on Escape', async () => {
    const { props, search } = await setup();
    document.querySelectorAll<HTMLButtonElement>('.emoji-picker .emoji')[2].click();
    expect(props.onPick).toHaveBeenCalledWith('🚀');
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(props.onClose).toHaveBeenCalled();
  });
});

// The emoji load after the picker opens; until then it says so rather than
// standing empty.
describe('EmojiPicker while the emoji load', () => {
  it('shows that it is loading', async () => {
    await setup([]);
    const bar = document.querySelector('.emoji-picker [role="progressbar"]');
    expect(bar?.getAttribute('aria-label') ?? bar?.textContent).toContain('Loading emoji');
  });
});
