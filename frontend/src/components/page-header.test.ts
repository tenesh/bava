// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import PageHeader from './PageHeader.svelte';

/**
 * The header with every crumb measured wider than its row, which jsdom gives
 * no width: the folders cannot fit even shortened, so they fold into one.
 */
function folded() {
  const measured = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 10));
  const { target } = render(PageHeader, { crumbs: ['Engineering', 'Architecture', 'Decisions'], locked: false, onMenu: () => {} });
  // Measured once, at mount; the tooltip then places itself as it would on any page jsdom lays out.
  measured.mockRestore();
  expect(target.querySelector('nav')?.dataset.fit).toBe('fold');
  return target.querySelector<HTMLElement>('.crumb.folded')!;
}

const tooltip = () => document.querySelector('[data-part="content"]:not([hidden])');

describe('PageHeader', () => {
  it('names the folded crumb by the folders it holds', () => {
    expect(folded().getAttribute('aria-label')).toBe('Engineering / Architecture');
  });

  it('lets the keyboard reach the folded crumb, which then shows the folders it holds', async () => {
    const crumb = folded();
    expect(crumb.tabIndex).toBe(0);
    // Ark opens a tooltip on focus-visible only: a keyboard user arrives with Tab.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    crumb.focus();
    await vi.waitFor(() => expect(tooltip()?.textContent).toContain('Engineering / Architecture'), { timeout: 2000 });
  });
});
