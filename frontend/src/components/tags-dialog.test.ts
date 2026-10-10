// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import TagsDialog from './TagsDialog.svelte';

const TAGS = [
  { tag: 'design', count: 4 },
  { tag: 'launch', count: 3 },
  { tag: 'q4', count: 5 },
];

async function setup(extra: Record<string, unknown> = {}) {
  const props = { open: true, tags: TAGS, pages: 9, renaming: null, onRename: vi.fn(), onMerge: vi.fn(), onDelete: vi.fn(), onOpenChange: vi.fn(), ...extra };
  render(TagsDialog, props as never);
  await vi.waitFor(() => expect(document.querySelector('.tags-table')).not.toBeNull());
  return props;
}

// A tag's name as read out: the drawn # is hidden from screen readers.
const spoken = (el: Element) => {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
  return copy.textContent?.trim();
};
const names = () => [...document.querySelectorAll('.tags-table tbody .tag-chip')].map(spoken);
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === label)!;
const box = (tag: string) => document.querySelector<HTMLInputElement>(`input[type="checkbox"][aria-label="Select ${tag}"]`)!;
const renameField = () => document.querySelector<HTMLInputElement>('.tags-table input.rename')!;
const key = (target: Element, name: string) => flushSync(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })));
const type = (input: HTMLInputElement, text: string) => {
  input.value = text;
  flushSync(() => input.dispatchEvent(new Event('input', { bubbles: true })));
};

describe('TagsDialog', () => {
  it('lists every tag with its page count, by name, or by pages', async () => {
    await setup();
    expect(names()).toEqual(['design', 'launch', 'q4']);
    flushSync(() => document.querySelector<HTMLElement>('.bava-select[data-name="Sort by"] .bava-select-trigger')!.click());
    const pages = await vi.waitFor(() => {
      const found = [...document.querySelectorAll<HTMLElement>('.bava-select-item')].find((item) => item.textContent?.trim() === 'Pages');
      if (!found) throw new Error('no list');
      return found;
    });
    flushSync(() => pages.click());
    expect(names()).toEqual(['q4', 'design', 'launch']);
  });

  it('narrows the list as the search is typed', async () => {
    await setup();
    type(document.querySelector<HTMLInputElement>('input[type="search"]')!, 'la');
    expect(names()).toEqual(['launch']);
  });

  it('renames a tag in its row, converting what is typed', async () => {
    const props = await setup();
    flushSync(() => button('Rename launch').click());
    type(renameField(), 'Big Launch');
    expect(renameField().value).toBe('big-launch');
    key(renameField(), 'Enter');
    expect(props.onRename).toHaveBeenCalledWith('launch', 'big-launch');
  });

  it('refuses a name another tag has, pointing to merging', async () => {
    const props = await setup();
    flushSync(() => button('Rename launch').click());
    type(renameField(), 'q4');
    key(renameField(), 'Enter');
    expect(props.onRename).not.toHaveBeenCalled();
    expect(document.querySelector('.refusal')!.textContent).toContain('q4 is already a tag');
  });

  it('leaves a rename on Escape, not the dialog', async () => {
    const props = await setup();
    flushSync(() => button('Rename launch').click());
    key(renameField(), 'Escape');
    expect(document.querySelector('.tags-table input.rename')).toBeNull();
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });

  it('starts renaming the tag it is opened for', async () => {
    await setup({ renaming: 'q4' });
    expect(renameField().value).toBe('q4');
  });

  it('selects several, and deletes them from the bar', async () => {
    const props = await setup();
    expect(document.querySelector('.bulk')).toBeNull();
    flushSync(() => box('design').click());
    flushSync(() => box('q4').click());
    expect(document.querySelector('.bulk')!.textContent).toContain('2 selected');
    button('Delete 2 tags').click();
    expect(props.onDelete).toHaveBeenCalledWith(['design', 'q4']);
  });

  it('selects every tag shown from the header box', async () => {
    await setup();
    flushSync(() => document.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Select all"]')!.click());
    expect(document.querySelector('.bulk')!.textContent).toContain('3 selected');
  });
});
