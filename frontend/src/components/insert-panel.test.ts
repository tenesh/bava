// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import InsertHarness from './__fixtures__/InsertHarness.svelte';

function setup() {
  const onOutcome = vi.fn();
  const { target, app } = render(InsertHarness, { onOutcome });
  const input = target.querySelector('input')!;
  const key = (k: string) => flushSync(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));
  return { app, target, input, key, onOutcome };
}

describe('InsertPanel', () => {
  it('focuses its search, and lists categories with a chevron clear of the text', () => {
    const { target, input } = setup();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('placeholder')).toBe('Insert item');
    const row = target.querySelector('[role="option"]')!;
    expect(row.textContent).toContain('Shape');
    expect(row.querySelector('.description')?.textContent).toContain('cylinders');
    expect(row.lastElementChild?.classList.contains('chevron')).toBe(true);
    expect(target.querySelector('.crumbs')?.textContent?.trim()).toBe('All Categories');
  });

  it('opens a category as a labelled grid, with a breadcrumb and the highlighted name in the footer', () => {
    const { target, key } = setup();
    key('Enter');
    expect(target.querySelector('.crumbs')?.textContent).toContain('Shape');
    const tiles = target.querySelectorAll('.tile');
    expect(tiles).toHaveLength(9);
    expect(tiles[0].textContent).toContain('Rectangle');
    key('ArrowRight');
    expect(target.querySelector('footer')?.textContent).toContain('Ellipse');
    expect(target.querySelector('[aria-selected="true"]')?.textContent).toContain('Ellipse');
  });

  it('reports a chosen shape, by keyboard and by click', () => {
    const { target, key, onOutcome } = setup();
    key('Enter');
    key('Enter');
    expect(onOutcome).toHaveBeenLastCalledWith({ type: 'choose', tool: 'rect' });
    (target.querySelectorAll('.tile')[3] as HTMLElement).click();
    expect(onOutcome).toHaveBeenLastCalledWith({ type: 'choose', tool: 'cylinder' });
  });

  it('reports close on Escape at the top', () => {
    const { key, onOutcome } = setup();
    key('Escape');
    expect(onOutcome).toHaveBeenLastCalledWith({ type: 'close' });
  });

  it('handles keys from anywhere inside it, and refocuses search after the breadcrumb', () => {
    const { target, key, onOutcome } = setup();
    key('Enter');
    const crumb = target.querySelector('.crumb') as HTMLButtonElement;
    crumb.focus();
    crumb.click();
    expect(document.activeElement).toBe(target.querySelector('input'));
    crumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onOutcome).toHaveBeenLastCalledWith({ type: 'close' });
  });

  it('closes on a press outside it', () => {
    const { onOutcome } = setup();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(onOutcome).toHaveBeenLastCalledWith({ type: 'close' });
  });

  // With a search typed, left and right move the caret, not the highlight.
  it('leaves left and right to the search field while there is a query', () => {
    const { input, key } = setup();
    input.value = 'c';
    flushSync(() => input.dispatchEvent(new Event('input', { bubbles: true })));
    const first = document.querySelector('[aria-selected="true"]')?.textContent;
    key('ArrowRight');
    expect(document.querySelector('[aria-selected="true"]')?.textContent).toBe(first);
  });
});

describe('the Icon category', () => {
  function openIcons(props: Record<string, unknown> = {}) {
    const onOutcome = vi.fn();
    const { target } = render(InsertHarness, { onOutcome, ...props });
    const input = () => target.querySelector('input')!;
    const key = (k: string) => flushSync(() => input().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));
    const tiles = () => [...target.querySelectorAll('.icon-grid .tile')] as HTMLElement[];
    flushSync(() => (target.querySelectorAll('[role="option"]')[4] as HTMLElement).click());
    return { target, input, key, tiles, onOutcome };
  }

  it('opens with its tabs, a search for icons and a grid of them', async () => {
    const { target, input, tiles } = openIcons();
    expect(target.querySelector('.crumbs')?.textContent).toContain('Icon');
    expect([...target.querySelectorAll('.bava-segment')].map((s) => s.textContent?.trim())).toEqual(['General', 'Logos', 'Custom']);
    expect(input().getAttribute('placeholder')).toBe('Search icons');
    await vi.waitFor(() => expect(tiles()).toHaveLength(3));
    expect(tiles()[0].querySelector('svg')).not.toBeNull();
    expect(tiles().map((tile) => tile.textContent?.trim())).toEqual(['database', 'database', 'server']);
  });

  it('searches as words are typed and places the highlighted icon on Enter', async () => {
    const { input, key, tiles, onOutcome } = openIcons();
    await vi.waitFor(() => expect(tiles()).toHaveLength(3));
    flushSync(() => {
      input().value = 'serv';
      input().dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(tiles()).toHaveLength(1);
    key('Enter');
    expect(onOutcome).toHaveBeenCalledWith({ type: 'icon', icon: 'line/server' });
  });

  it('leaves the arrow keys and Enter on its tabs to the tabs', async () => {
    const { target, tiles, onOutcome } = openIcons();
    await vi.waitFor(() => expect(tiles()).toHaveLength(3));
    const tab = target.querySelector('.bava-segment') as HTMLElement;
    for (const key of ['ArrowRight', 'Enter']) flushSync(() => tab.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
    expect(target.querySelector('.icon-grid [aria-selected="true"]')).toBe(tiles()[0]);
    expect(onOutcome).not.toHaveBeenCalled();
  });

  it('goes back to all categories with Escape', async () => {
    const { target, key } = openIcons();
    key('Escape');
    expect(target.querySelector('.crumbs')?.textContent?.trim()).toBe('All Categories');
  });

  it('says so when a set cannot be loaded', async () => {
    const { target } = openIcons({ failLogos: true });
    flushSync(() => ([...target.querySelectorAll('.bava-segment')][1] as HTMLElement).click());
    await vi.waitFor(() => expect(target.querySelector('.icon-grid')?.textContent).toContain("couldn't be loaded"));
  });
});

/** Choose an item in the open menu by keyboard, as Ark's menus are driven in jsdom. */
async function choose(target: HTMLElement, label: string) {
  const menu = await vi.waitFor(() => {
    const content = target.querySelector('[data-scope="menu"][data-part="content"]') as HTMLElement | null;
    expect(content).not.toBeNull();
    return content!;
  });
  const press = (key: string) => flushSync(() => menu.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
  for (let i = 0; i < 4; i += 1) {
    press('ArrowDown');
    if (menu.querySelector('[data-highlighted]')?.textContent?.includes(label)) break;
  }
  await vi.waitFor(() => expect(menu.querySelector('[data-highlighted]')?.textContent).toContain(label));
  press('Enter');
}

describe("the Icon category's Custom tab", () => {
  const acme = { set: 'custom' as const, name: 'acme', title: 'acme', keywords: [], svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>' };

  function openCustom() {
    const library = { add: vi.fn(), showFolder: vi.fn(), rename: vi.fn(async () => ''), remove: vi.fn(async () => '') };
    const { target } = render(InsertHarness, { onOutcome: vi.fn(), library, custom: [acme] });
    flushSync(() => (target.querySelectorAll('[role="option"]')[4] as HTMLElement).click());
    flushSync(() => ([...target.querySelectorAll('.bava-segment')][2] as HTMLElement).click());
    const tile = () => target.querySelector('.icon-grid .tile') as HTMLElement;
    return { target, library, tile };
  }

  it('shows the dark copy of an icon in a dark theme', async () => {
    const library = { add: vi.fn(), showFolder: vi.fn(), rename: vi.fn(async () => ''), remove: vi.fn(async () => '') };
    const darkSvg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#5EEAD4"/></svg>';
    const { target } = render(InsertHarness, { onOutcome: vi.fn(), library, custom: [{ ...acme, darkSvg }], dark: true });
    flushSync(() => (target.querySelectorAll('[role="option"]')[4] as HTMLElement).click());
    flushSync(() => ([...target.querySelectorAll('.bava-segment')][2] as HTMLElement).click());
    await vi.waitFor(() => expect(decodeURIComponent(target.querySelector('.icon-grid img')?.getAttribute('src') ?? '')).toContain('#5EEAD4'));
  });

  it('offers Add icons and Show folder, and draws an icon in its own colours', async () => {
    const { target, library, tile } = openCustom();
    await vi.waitFor(() => expect(tile()?.querySelector('img')).not.toBeNull());
    const button = (name: string) => [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) as HTMLElement;
    flushSync(() => button('Add icons').click());
    flushSync(() => button('Show folder').click());
    expect(library.add).toHaveBeenCalledOnce();
    expect(library.showFolder).toHaveBeenCalledOnce();
  });

  it('renames an icon from its right-click menu, typed in place', async () => {
    const { target, library, tile } = openCustom();
    await vi.waitFor(() => expect(tile()).not.toBeNull());
    flushSync(() => tile().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })));
    await choose(target, 'Rename');
    const field = await vi.waitFor(() => {
      const input = target.querySelector('.icon-grid input') as HTMLInputElement | null;
      expect(input?.value).toBe('acme');
      return input!;
    });
    flushSync(() => {
      field.value = 'billing';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await vi.waitFor(() => expect(library.rename).toHaveBeenCalledWith('acme', 'billing'));
  });

  // Leaving the field after Enter or Escape is no second answer; Escape gives the keys back to the search.
  it('cancels a rename with Escape, and renames once with Enter', async () => {
    const { target, library, tile } = openCustom();
    await vi.waitFor(() => expect(tile()).not.toBeNull());
    const open = async () => {
      flushSync(() => tile().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })));
      await choose(target, 'Rename');
      return vi.waitFor(() => {
        const input = target.querySelector('.icon-grid input') as HTMLInputElement | null;
        expect(input).not.toBeNull();
        return input!;
      });
    };
    let field = await open();
    flushSync(() => {
      field.value = 'typed';
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      field.dispatchEvent(new FocusEvent('blur'));
    });
    expect(library.rename).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(document.activeElement).toBe(target.querySelector('.search input')));
    field = await open();
    flushSync(() => {
      field.value = 'billing';
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      field.dispatchEvent(new FocusEvent('blur'));
    });
    await vi.waitFor(() => expect(library.rename).toHaveBeenCalledTimes(1));
  });

  it('deletes an icon from its right-click menu', async () => {
    const { target, library, tile } = openCustom();
    await vi.waitFor(() => expect(tile()).not.toBeNull());
    flushSync(() => tile().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })));
    await choose(target, 'Delete');
    await vi.waitFor(() => expect(library.remove).toHaveBeenCalledWith('acme'));
  });
});
