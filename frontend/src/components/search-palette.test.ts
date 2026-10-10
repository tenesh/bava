// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import SearchPalette from './SearchPalette.svelte';
import type { SearchHit } from '../files/space.svelte';

const hits: SearchHit[] = [
  { kind: 'folder', path: 'Launch kit', name: 'Launch kit', folder: 'Marketing', count: 1, best: { where: 'name', text: '', word: '', occurrence: 0, element: '' } },
  { kind: 'page', path: 'Marketing/Launch plan.md', name: 'Launch plan', folder: 'Marketing', count: 7, best: { where: 'document', text: 'How we take Bava to launch.', word: 'launch', occurrence: 0, element: '' } },
  { kind: 'page', path: 'Roadmap.md', name: 'Roadmap', folder: '', count: 1, best: { where: 'canvas', text: 'Q4: launch 1.0', word: 'launch', occurrence: 0, element: 'e1' } },
];

function setup(extra: Record<string, unknown> = {}) {
  const props = { query: 'launch', hits, more: false, failed: false, highlighted: 1, onQuery: vi.fn(), onMove: vi.fn(), onChoose: vi.fn(), onClose: vi.fn(), ...extra };
  render(SearchPalette, props as never);
  return props;
}

const field = () => document.querySelector<HTMLInputElement>('.search-palette input')!;
const rows = () => [...document.querySelectorAll<HTMLElement>('.search-palette [role="option"]')];
const key = (name: string) => flushSync(() => field().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })));

describe('SearchPalette', () => {
  it('shows only a hint before anything is typed', () => {
    setup({ query: '', hits: [] });
    expect(document.querySelector('.search-palette')!.textContent).toContain('Search pages, folders and canvases');
    expect(rows()).toHaveLength(0);
  });

  it('lists each result with its name, folder, count and best match, the words marked', () => {
    setup();
    expect(rows()).toHaveLength(3);
    const page = rows()[1];
    expect(page.querySelector('.name')!.textContent).toBe('Launch plan');
    expect(page.querySelector('.folder')!.textContent).toBe('Marketing');
    expect(page.querySelector('.count')!.textContent).toBe('7');
    expect(page.querySelector('.snippet mark')!.textContent).toBe('launch');
    expect(rows()[2].querySelector('.snippet')!.textContent).toContain('On the canvas: Q4: launch 1.0');
  });

  it('shows where a result found by its name sits', () => {
    setup();
    expect(rows()[0].querySelector('.snippet')!.textContent).toBe('Marketing');
  });

  it('says when nothing matched, and when there were more than shown', () => {
    setup({ hits: [] });
    expect(document.querySelector('.search-palette')!.textContent).toContain('No results');
    document.body.innerHTML = '';
    setup({ more: true });
    expect(document.querySelector('.search-palette')!.textContent).toContain('Showing the first 50');
  });

  it('reports typing, moving, choosing and closing', () => {
    const props = setup();
    field().value = 'launch d';
    flushSync(() => field().dispatchEvent(new Event('input', { bubbles: true })));
    expect(props.onQuery).toHaveBeenCalledWith('launch d');
    key('ArrowDown');
    expect(props.onMove).toHaveBeenCalledWith(1);
    key('ArrowUp');
    expect(props.onMove).toHaveBeenCalledWith(-1);
    key('Enter');
    expect(props.onChoose).toHaveBeenCalledWith(hits[1]);
    key('Escape');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('names the highlighted row for a screen reader', () => {
    setup();
    const active = field().getAttribute('aria-activedescendant')!;
    expect(document.getElementById(active)).toBe(rows()[1]);
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');
  });

  // A listbox holds only its options; the notes say what is in it beside it.
  it('keeps its notes outside the list of results', () => {
    setup({ more: true });
    expect(document.querySelector('[role="listbox"] p')).toBeNull();
    expect(document.querySelector('.search-palette [role="status"]')!.textContent).toContain('Showing the first 50');
  });

  // Over the window as a modal, and Tab stays on the field rather than
  // wandering to the window behind.
  it('is a modal that keeps Tab on its field', () => {
    setup();
    expect(document.querySelector('.search-palette')!.getAttribute('aria-modal')).toBe('true');
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    field().dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
  });

  it('names each result as a page or a folder', () => {
    setup();
    expect(rows()[0].querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Folder');
    expect(rows()[1].querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Page');
  });

  it('focuses the field when it opens', () => {
    setup();
    expect(document.activeElement).toBe(field());
  });
});
