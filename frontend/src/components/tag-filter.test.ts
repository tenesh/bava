// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import TagFilter from './TagFilter.svelte';

const TAGS = [
  { tag: 'design', count: 4 },
  { tag: 'launch', count: 3 },
  { tag: 'q4', count: 5 },
];

async function setup(extra: Record<string, unknown> = {}) {
  const props = { at: { left: 10, top: 40, bottom: 60 }, tags: TAGS, chosen: ['launch'], onToggle: vi.fn(), onMenu: vi.fn(), onManage: vi.fn(), onClose: vi.fn(), ...extra };
  render(TagFilter, props as never);
  await vi.waitFor(() => expect(document.querySelector('.tag-filter input')).not.toBeNull());
  return { props, search: document.querySelector<HTMLInputElement>('.tag-filter input')! };
}

const rows = () => [...document.querySelectorAll('.tag-filter [role="option"]')].map((row) => [row.querySelector('.name')!.textContent, row.querySelector('.count')!.textContent, row.getAttribute('aria-selected')]);
const key = (target: Element, name: string) => flushSync(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })));

describe('TagFilter', () => {
  it('lists each tag with its page count, the chosen ones marked, the search focused', async () => {
    const { search } = await setup();
    expect(rows()).toEqual([
      ['design', '4', 'false'],
      ['launch', '3', 'true'],
      ['q4', '5', 'false'],
    ]);
    expect(document.activeElement).toBe(search);
  });

  it('narrows the list as the search is typed', async () => {
    const { search } = await setup();
    search.value = 'l';
    flushSync(() => search.dispatchEvent(new Event('input', { bubbles: true })));
    expect(rows().map((row) => row[0])).toEqual(['launch']);
  });

  it('reports a tag chosen by pointer or by keys', async () => {
    const { props, search } = await setup();
    document.querySelectorAll<HTMLElement>('.tag-filter [role="option"]')[2].click();
    expect(props.onToggle).toHaveBeenCalledWith('q4');
    key(search, 'ArrowDown');
    key(search, 'Enter');
    expect(props.onToggle).toHaveBeenLastCalledWith('launch');
  });

  it('opens a tag\'s menu from its own button, and Manage tags', async () => {
    const { props } = await setup();
    document.querySelector<HTMLButtonElement>('.tag-filter button[aria-label="More for q4"]')!.click();
    expect(props.onMenu).toHaveBeenCalledWith('q4', expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    [...document.querySelectorAll<HTMLButtonElement>('.tag-filter button')].find((b) => b.textContent?.includes('Manage tags'))!.click();
    expect(props.onManage).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const { props, search } = await setup();
    key(search, 'Escape');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('says so when the Space has no tags', async () => {
    await setup({ tags: [] });
    expect(document.querySelector('.tag-filter')!.textContent).toContain('No tags yet');
  });
});
