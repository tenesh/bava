// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import CommandPalette from './CommandPalette.svelte';
import type { PaletteGroup } from '../shell/palette';

const groups: PaletteGroup[] = [
  { title: 'Recent', commands: [{ id: 'view.zoomToFit', label: 'Zoom to Fit', path: 'View', menu: 'View', keys: '⇧1' }] },
  {
    title: 'File',
    commands: [
      { id: 'file.new', label: 'New Page', path: 'File', menu: 'File', keys: '⌘N' },
      { id: 'file.exportPage', label: 'Page', path: 'File ▸ Export', menu: 'File', keys: '' },
    ],
  },
];

function setup(extra: Record<string, unknown> = {}) {
  const props = { query: '', groups, highlighted: 0, onQuery: vi.fn(), onMove: vi.fn(), onRun: vi.fn(), onClose: vi.fn(), ...extra };
  render(CommandPalette, props as never);
  return props;
}

const palette = () => document.querySelector<HTMLElement>('.command-palette')!;
const field = () => palette().querySelector<HTMLInputElement>('input')!;
const rows = () => [...palette().querySelectorAll<HTMLElement>('[role="option"]')];
const key = (name: string) => flushSync(() => field().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })));

describe('CommandPalette', () => {
  it('lists each group under its title, each command with its path and keys', () => {
    setup();
    expect([...palette().querySelectorAll('.group-title')].map((title) => title.textContent)).toEqual(['Recent', 'File']);
    expect(rows()).toHaveLength(3);
    const page = rows()[2];
    expect(page.querySelector('.label')!.textContent).toBe('Page');
    expect(page.querySelector('.path')!.textContent).toBe('File ▸ Export');
    expect(rows()[1].querySelector('.keys .spoken')!.textContent).toBe('⌘N');
  });

  it('shows the path only where it says more than the group does', () => {
    setup();
    expect(rows()[1].querySelector('.path')).toBeNull();
  });

  it('marks the words typed in each label', () => {
    setup({ query: 'new', groups: [{ title: '', commands: [groups[1].commands[0]] }] });
    expect(palette().querySelector('.label mark')!.textContent).toBe('New');
    expect(palette().querySelector('.group-title')).toBeNull();
  });

  it('says when nothing matches', () => {
    setup({ query: 'xyzzy', groups: [] });
    expect(palette().textContent).toContain('No command matches');
  });

  it('marks the highlighted row, and moves it with the arrows', () => {
    const props = setup({ highlighted: 1 });
    expect(rows()[1].hasAttribute('data-highlighted')).toBe(true);
    expect(field().getAttribute('aria-activedescendant')).toBe(rows()[1].id);
    key('ArrowDown');
    expect(props.onMove).toHaveBeenCalledWith(1);
    key('ArrowUp');
    expect(props.onMove).toHaveBeenCalledWith(-1);
  });

  it('runs the highlighted command on Enter, and any on a click', () => {
    const props = setup({ highlighted: 2 });
    key('Enter');
    expect(props.onRun).toHaveBeenCalledWith('file.exportPage');
    rows()[0].click();
    expect(props.onRun).toHaveBeenCalledWith('view.zoomToFit');
  });

  it('reports what is typed, and closes on Escape', () => {
    const props = setup();
    field().value = 'zoom';
    field().dispatchEvent(new Event('input', { bubbles: true }));
    expect(props.onQuery).toHaveBeenCalledWith('zoom');
    key('Escape');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('takes the keyboard as it opens', () => {
    setup();
    expect(document.activeElement).toBe(field());
  });

  it('closes on a press outside it', () => {
    const props = setup();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
