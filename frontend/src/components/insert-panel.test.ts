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
