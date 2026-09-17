// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import InsertHarness from './fixtures/InsertHarness.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render() {
  const target = document.createElement('div');
  document.body.append(target);
  const onOutcome = vi.fn();
  const app = flushSync(() => mount(InsertHarness, { target, props: { onOutcome } }));
  const input = target.querySelector('input')!;
  const key = (k: string) => flushSync(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));
  return { app, target, input, key, onOutcome };
}

describe('InsertPanel', () => {
  it('focuses its search, and lists categories with a chevron clear of the text', () => {
    const { app, target, input } = render();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('placeholder')).toBe('Insert item');
    const row = target.querySelector('[role="option"]')!;
    expect(row.textContent).toContain('Shape');
    expect(row.querySelector('.description')?.textContent).toContain('cylinders');
    expect(row.lastElementChild?.classList.contains('chevron')).toBe(true);
    expect(target.querySelector('.crumbs')?.textContent?.trim()).toBe('All Categories');
    unmount(app);
  });

  it('opens a category as a labelled grid, with a breadcrumb and the highlighted name in the footer', () => {
    const { app, target, key } = render();
    key('Enter');
    expect(target.querySelector('.crumbs')?.textContent).toContain('Shape');
    const tiles = target.querySelectorAll('.tile');
    expect(tiles).toHaveLength(9);
    expect(tiles[0].textContent).toContain('Rectangle');
    key('ArrowRight');
    expect(target.querySelector('footer')?.textContent).toContain('Ellipse');
    expect(target.querySelector('[aria-selected="true"]')?.textContent).toContain('Ellipse');
    unmount(app);
  });

  it('reports a chosen shape, by keyboard and by click', () => {
    const { app, target, key, onOutcome } = render();
    key('Enter');
    key('Enter');
    expect(onOutcome).toHaveBeenLastCalledWith({ type: 'choose', tool: 'rect' });
    (target.querySelectorAll('.tile')[3] as HTMLElement).click();
    expect(onOutcome).toHaveBeenLastCalledWith({ type: 'choose', tool: 'cylinder' });
    unmount(app);
  });

  it('reports close on Escape at the top', () => {
    const { app, key, onOutcome } = render();
    key('Escape');
    expect(onOutcome).toHaveBeenLastCalledWith({ type: 'close' });
    unmount(app);
  });

  it('handles keys from anywhere inside it, and refocuses search after the breadcrumb', () => {
    const { app, target, key, onOutcome } = render();
    key('Enter');
    const crumb = target.querySelector('.crumb') as HTMLButtonElement;
    crumb.focus();
    crumb.click();
    expect(document.activeElement).toBe(target.querySelector('input'));
    crumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onOutcome).toHaveBeenLastCalledWith({ type: 'close' });
    unmount(app);
  });

  it('closes on a press outside it', () => {
    const { app, onOutcome } = render();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(onOutcome).toHaveBeenLastCalledWith({ type: 'close' });
    unmount(app);
  });

  // With a search typed, left and right move the caret, not the highlight.
  it('leaves left and right to the search field while there is a query', () => {
    const { app, input, key } = render();
    input.value = 'c';
    flushSync(() => input.dispatchEvent(new Event('input', { bubbles: true })));
    const first = document.querySelector('[aria-selected="true"]')?.textContent;
    key('ArrowRight');
    expect(document.querySelector('[aria-selected="true"]')?.textContent).toBe(first);
    unmount(app);
  });
});
