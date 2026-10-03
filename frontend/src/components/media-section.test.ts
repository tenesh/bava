// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import MediaSection from './MediaSection.svelte';
import type { MediaItem } from '../files/media';

const item = (name: string, kind: MediaItem['kind'], size: number): MediaItem => ({
  name,
  kind,
  size,
  modified: '2026-09-01T00:00:00Z',
  usedBy: [],
  unused: true,
  poster: null,
});

function setup(items: MediaItem[]) {
  const props = {
    items,
    thumb: (i: MediaItem) => (i.kind === 'image' ? `/bava-file/?path=${encodeURIComponent(i.name)}` : null),
    onAdd: vi.fn(),
    onOpenDialog: vi.fn(),
    onPlace: vi.fn(),
  };
  const { target } = render(MediaSection, props);
  return { props, target };
}

const rows = (target: HTMLElement) => [...target.querySelectorAll<HTMLElement>('.media-row')];

describe('MediaSection', () => {
  it('lists each attachment with its thumbnail, name and size, by name', () => {
    const { target } = setup([item('logo.png', 'image', 1_536), item('Q3 report.pdf', 'pdf', 20_000)]);
    expect(rows(target).map((r) => r.querySelector('.media-row-name')!.textContent)).toEqual(['logo.png', 'Q3 report.pdf']);
    expect(rows(target)[0].querySelector('.media-row-size')!.textContent).toBe('1.5 KB');
    expect(rows(target)[0].querySelector('img')!.getAttribute('src')).toBe('/bava-file/?path=logo.png');
    // A file with no picture shows its kind's icon.
    expect(rows(target)[1].querySelector('img')).toBeNull();
    expect(rows(target)[1].querySelector('svg')).not.toBeNull();
  });

  it('narrows the list as a name is searched', () => {
    const { target } = setup([item('logo.png', 'image', 1), item('Q3 report.pdf', 'pdf', 1)]);
    const search = target.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'REPORT';
    flushSync(() => search.dispatchEvent(new Event('input', { bubbles: true })));
    expect(rows(target).map((r) => r.querySelector('.media-row-name')!.textContent)).toEqual(['Q3 report.pdf']);
  });

  it('says so when there is nothing yet', () => {
    const { target } = setup([]);
    expect(target.textContent).toContain('No files yet');
  });

  it('carries a row dragged into the page by its name', () => {
    const { target } = setup([item('logo.png', 'image', 1)]);
    const data = new Map<string, string>();
    const event = new Event('dragstart', { bubbles: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: { setData: (k: string, v: string) => data.set(k, v), effectAllowed: '' } });
    rows(target)[0].dispatchEvent(event);
    expect(data.get('application/x-bava-attachment')).toBe('logo.png');
  });

  it('places a row at the caret with Enter or a double-click, and moves between rows with the arrows', () => {
    const { target, props } = setup([item('a.png', 'image', 1), item('b.png', 'image', 1)]);
    const [first, second] = rows(target);
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(second);
    second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(props.onPlace).toHaveBeenCalledWith('b.png');
    first.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(props.onPlace).toHaveBeenCalledWith('a.png');
  });

  it('reports Add files and the dialog button', () => {
    const { target, props } = setup([]);
    target.querySelector<HTMLButtonElement>('button[aria-label="Add files"]')!.click();
    target.querySelector<HTMLButtonElement>('button[aria-label="Open Media"]')!.click();
    expect(props.onAdd).toHaveBeenCalled();
    expect(props.onOpenDialog).toHaveBeenCalled();
  });
});
