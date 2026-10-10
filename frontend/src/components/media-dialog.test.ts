// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import MediaDialog from './MediaDialog.svelte';
import type { MediaItem } from '../files/media';

const item = (name: string, kind: MediaItem['kind'], size: number, modified: string, usedBy: { name: string; path: string }[] = []): MediaItem => ({
  name,
  kind,
  size,
  modified,
  usedBy,
  unused: usedBy.length === 0,
  poster: null,
});

const items = [
  item('logo.png', 'image', 1_000, '2026-09-01T00:00:00Z', [{ name: 'Home', path: 'Home.md' }, { name: 'Launch', path: 'Marketing/Launch.md' }]),
  item('demo.mp4', 'video', 90_000, '2026-09-03T00:00:00Z', [{ name: 'Launch', path: 'Marketing/Launch.md' }]),
  item('old.png', 'image', 2_000, '2026-08-01T00:00:00Z'),
  item('notes.pdf', 'pdf', 5_000, '2026-09-02T00:00:00Z'),
];

async function setup() {
  const props = {
    open: true,
    items,
    usageKnown: true,
    thumb: () => null,
    onOpenChange: vi.fn(),
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onDelete: vi.fn(),
    onReveal: vi.fn(),
    onOpenPage: vi.fn(),
    onTrashUnused: vi.fn(),
  };
  render(MediaDialog, props);
  await vi.waitFor(() => expect(document.querySelector('.media-dialog')).not.toBeNull());
  return { props, dialog: document.querySelector<HTMLElement>('.media-dialog')! };
}

const names = (dialog: HTMLElement) => [...dialog.querySelectorAll('.media-item-name')].map((el) => el.textContent);
const click = (el: Element) => flushSync(() => (el as HTMLElement).click());
const button = (dialog: HTMLElement, name: string) => [...dialog.querySelectorAll('button, [data-part="item"]')].find((b) => b.textContent?.trim() === name || b.getAttribute('aria-label') === name)!;

/** Picks an option from one of the dialog's dropdowns, by the dropdown's name. */
async function pick(dialog: HTMLElement, dropdown: string, option: string) {
  click(dialog.querySelector(`.bava-select[data-name="${dropdown}"] .bava-select-trigger`)!);
  const item = await vi.waitFor(() => {
    const found = [...document.querySelectorAll<HTMLElement>('.bava-select-item')].find((each) => each.textContent?.trim() === option && each.closest('[data-state="open"]'));
    if (!found) throw new Error(`no ${option} in ${dropdown}`);
    return found;
  });
  click(item);
}

describe('MediaDialog', () => {
  it('shows every file in a grid by name, and as a list', async () => {
    const { dialog } = await setup();
    expect(dialog.querySelector('.media-items')!.getAttribute('data-view')).toBe('grid');
    expect(names(dialog)).toEqual(['demo.mp4', 'logo.png', 'notes.pdf', 'old.png']);
    click(button(dialog, 'List'));
    expect(dialog.querySelector('.media-items')!.getAttribute('data-view')).toBe('list');
  });

  it('filters by kind and to the unused, and sorts by size or date, from two dropdowns', async () => {
    const { dialog } = await setup();
    await pick(dialog, 'Type', 'Unused');
    expect(names(dialog)).toEqual(['notes.pdf', 'old.png']);
    await pick(dialog, 'Type', 'Images');
    expect(names(dialog)).toEqual(['logo.png', 'old.png']);
    await pick(dialog, 'Type', 'All types');
    await pick(dialog, 'Sort by', 'Size');
    expect(names(dialog)[0]).toBe('demo.mp4');
    await pick(dialog, 'Sort by', 'Date');
    expect(names(dialog)).toEqual(['demo.mp4', 'notes.pdf', 'logo.png', 'old.png']);
  });

  it("shows a file's pages, and opens one", async () => {
    const { dialog, props } = await setup();
    click(dialog.querySelector('[data-name="logo.png"]')!);
    const pages = [...dialog.querySelectorAll('.media-used-by button')];
    expect(pages.map((p) => p.textContent?.trim())).toEqual(['Home', 'Launch']);
    click(pages[1]);
    expect(props.onOpenPage).toHaveBeenCalledWith('Marketing/Launch.md');
  });

  it('renames, shows in folder and deletes the file chosen', async () => {
    const { dialog, props } = await setup();
    click(dialog.querySelector('[data-name="old.png"]')!);
    click(button(dialog, 'Rename'));
    const field = dialog.querySelector<HTMLInputElement>('input.media-rename')!;
    expect(field.value).toBe('old');
    field.value = 'older';
    flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
    flushSync(() => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(props.onRename).toHaveBeenCalledWith('old.png', 'older');
    click(button(dialog, 'Show in folder'));
    expect(props.onReveal).toHaveBeenCalledWith('old.png');
    click(button(dialog, 'Delete'));
    expect(props.onDelete).toHaveBeenCalledWith(expect.objectContaining({ name: 'old.png' }));
  });

  it('offers to move the unused to the Trash, and to add files', async () => {
    const { props } = await setup();
    // In the dialog's header, beside its title.
    click(button(document.body, 'Move unused to Trash'));
    expect(props.onTrashUnused).toHaveBeenCalled();
    click(button(document.body, 'Add files'));
    expect(props.onAdd).toHaveBeenCalled();
  });

  it('is one stop for Tab, and the arrows move through the files, choosing each', async () => {
    const { dialog } = await setup();
    click(button(dialog, 'List'));
    const all = [...dialog.querySelectorAll<HTMLElement>('.media-item')];
    expect(all.map((el) => el.tabIndex)).toEqual([0, -1, -1, -1]);
    all[0].focus();
    flushSync(() => all[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(document.activeElement).toBe(all[1]);
    expect(dialog.querySelector('.detail-name')!.textContent).toBe('logo.png');
    expect(all.map((el) => el.tabIndex)).toEqual([-1, 0, -1, -1]);
  });
});

describe('MediaDialog renaming', () => {
  async function renameField(dialog: HTMLElement) {
    click(dialog.querySelector('[data-name="old.png"]')!);
    click(button(dialog, 'Rename'));
    return dialog.querySelector<HTMLInputElement>('input.media-rename')!;
  }

  function press(field: HTMLInputElement, key: string) {
    flushSync(() => field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })));
  }

  // Ark listens for Escape on the whole page before the field hears it, so
  // the field's own handler alone could not stop the dialog closing.
  it('leaves the rename on Escape and keeps the dialog open', async () => {
    const { dialog, props } = await setup();
    const field = await renameField(dialog);
    press(field, 'Escape');
    expect(dialog.querySelector('input.media-rename')).toBeNull();
    expect(props.onOpenChange).not.toHaveBeenCalled();
    expect(document.querySelector('.bava-dialog-content')!.getAttribute('data-state')).toBe('open');
  });

  it('still closes on Escape when nothing is being renamed', async () => {
    const { props } = await setup();
    const search = document.querySelector<HTMLInputElement>('.media-dialog .search')!;
    flushSync(() => search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  // The dialog is modal: a refusal told only in the status bar sat behind it.
  it('says why a name is refused under the field, keeping the field and the keyboard there', async () => {
    const { dialog, props } = await setup();
    props.onRename.mockResolvedValue('A file named older.png is already there.');
    const field = await renameField(dialog);
    field.value = 'older';
    flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
    press(field, 'Enter');
    await vi.waitFor(() => expect(dialog.querySelector('[role="alert"]')?.textContent).toBe('A file named older.png is already there.'));
    const still = dialog.querySelector<HTMLInputElement>('input.media-rename')!;
    expect(still.value).toBe('older');
    expect(still.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(still);
  });

  it('drops the refusal once the name changes', async () => {
    const { dialog, props } = await setup();
    props.onRename.mockResolvedValue('A file named older.png is already there.');
    const field = await renameField(dialog);
    field.value = 'older';
    flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
    press(field, 'Enter');
    await vi.waitFor(() => expect(dialog.querySelector('[role="alert"]')).not.toBeNull());
    field.value = 'oldest';
    flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
    expect(dialog.querySelector('[role="alert"]')).toBeNull();
  });

  it('closes the field once the rename is taken', async () => {
    const { dialog, props } = await setup();
    props.onRename.mockResolvedValue(null);
    const field = await renameField(dialog);
    field.value = 'older';
    flushSync(() => field.dispatchEvent(new Event('input', { bubbles: true })));
    press(field, 'Enter');
    await vi.waitFor(() => expect(dialog.querySelector('input.media-rename')).toBeNull());
  });
});
