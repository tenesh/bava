// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import FramePicker from './FramePicker.svelte';

const GROUPS = [
  { page: null, title: 'This page', frames: [{ id: 'f1', label: 'Write path', thumb: 'blob:one' }, { id: 'f2', label: 'Read path', thumb: null }] },
  { page: 'Engineering/Architecture.md', title: 'Architecture', frames: [{ id: 'f9', label: 'Overview', thumb: 'blob:two' }] },
];

async function setup(groups = GROUPS) {
  const props = { at: { left: 10, top: 40, bottom: 60 }, groups, onPick: vi.fn(), onClose: vi.fn() };
  render(FramePicker, props);
  await vi.waitFor(() => expect(document.querySelector('.frame-picker input')).not.toBeNull());
  return { props, search: document.querySelector<HTMLInputElement>('.frame-picker input')! };
}

const shown = () => [...document.querySelectorAll('.frame-picker [role="option"]')].map((row) => row.textContent?.trim());
const key = (target: Element, name: string) => flushSync(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })));
const type = (field: HTMLInputElement, text: string) => {
  field.value = text;
  field.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('FramePicker', () => {
  it("lists this page's frames first, then each other page's under its name, with the search focused", async () => {
    const { search } = await setup();
    expect(shown()).toEqual(['Write path', 'Read path', 'Overview']);
    expect([...document.querySelectorAll('.frame-picker h3')].map((h) => h.textContent)).toEqual(['This page', 'Architecture']);
    expect(document.activeElement).toBe(search);
    expect(document.querySelectorAll('.frame-picker img')).toHaveLength(2);
  });

  it('narrows to the frames whose names match, and says when none does', async () => {
    const { search } = await setup();
    type(search, 'path');
    await vi.waitFor(() => expect(shown()).toEqual(['Write path', 'Read path']));
    type(search, 'zzz');
    await vi.waitFor(() => expect(document.querySelector('.frame-picker')!.textContent).toContain('No frame has that name.'));
  });

  it('picks a frame with a click, saying the page it is on', async () => {
    const { props } = await setup();
    [...document.querySelectorAll<HTMLElement>('.frame-picker [role="option"]')][2].click();
    expect(props.onPick).toHaveBeenCalledWith('f9', 'Engineering/Architecture.md');
  });

  it('moves through the frames with the arrow keys and picks with Enter', async () => {
    const { props, search } = await setup();
    key(search, 'ArrowDown');
    key(search, 'ArrowDown');
    expect(document.querySelector('.frame-picker [data-highlighted]')?.textContent?.trim()).toBe('Overview');
    key(search, 'ArrowUp');
    key(search, 'Enter');
    expect(props.onPick).toHaveBeenCalledWith('f2', null);
  });

  it('closes on Escape', async () => {
    const { props, search } = await setup();
    key(search, 'Escape');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('says how to make a frame when there is none', async () => {
    await setup([]);
    expect(document.querySelector('.frame-picker')!.textContent).toContain('No frames yet.');
  });
});
