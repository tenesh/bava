// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import SelectionToolbar from './SelectionToolbar.svelte';
import { overflowMenu, type MenuNode } from '../canvas/context-menu';

const ids = (nodes: MenuNode[]): string[] =>
  nodes.map((node) => (node.kind === 'separator' ? '---' : node.kind === 'submenu' ? `${node.id}▸` : node.id));

function setup(props: Record<string, unknown>) {
  const onApply = vi.fn();
  const onCommand = vi.fn();
  const onMore = vi.fn();
  const { target, app } = render(SelectionToolbar, {
    styles: { fill: null, stroke: 'blue', color: 'unavailable' },
    align: false,
    distribute: false,
    onApply,
    onCommand,
    onMore,
    ...props,
  } as never);
  const button = (name: string) => [...target.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === name);
  return { app, target, button, onApply, onCommand, onMore };
}

describe('SelectionToolbar', () => {
  it('shows the colour pickers that apply and More, without align for one unit', () => {
    const { button } = setup({});
    expect(button('Fill colour')).toBeDefined();
    expect(button('Border colour')).toBeDefined();
    expect(button('Text colour')).toBeUndefined();
    expect(button('Align left')).toBeUndefined();
    expect(button('More actions')).toBeDefined();
  });

  it('shows align buttons for two units, reporting the command', () => {
    const two = setup({ align: true });
    expect(two.button('Distribute horizontally')).toBeUndefined();
    two.button('Align left')!.click();
    expect(two.onCommand).toHaveBeenCalledWith('canvas.alignLeft');
  });

  it('shows distribute buttons for three units, reporting the command', () => {
    const three = setup({ align: true, distribute: true });
    three.button('Distribute vertically')!.click();
    expect(three.onCommand).toHaveBeenCalledWith('canvas.distributeVertical');
  });

  it('reports More with where it is, so the menu can open there', () => {
    const { button, onMore } = setup({});
    button('More actions')!.click();
    // Where it sits, and what did not fit into the row.
    expect(onMore).toHaveBeenCalledWith(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }), []);
  });
});

// The row shows the controls the model gives it, and moves what does not fit
// into More.
describe('SelectionToolbar controls', () => {
  const controls = [
    { id: 'fill', group: 'colour', kind: 'colour' },
    { id: 'strokeWidth', group: 'stroke', kind: 'options' },
    { id: 'strokeStyle', group: 'stroke', kind: 'options' },
    { id: 'opacity', group: 'stroke', kind: 'slider' },
    { id: 'fontSize', group: 'label', kind: 'options' },
  ] as never;

  function renderControls(props: Record<string, unknown> = {}) {
    const onProperty = vi.fn();
    const { target, app } = render(SelectionToolbar, {
      styles: { fill: null, stroke: 'unavailable', color: 'unavailable' },
      controls,
      properties: { strokeWidth: null, strokeStyle: null, opacity: null, fontSize: null },
      align: false,
      distribute: false,
      onApply: vi.fn(),
      onProperty,
      onCommand: vi.fn(),
      onMore: vi.fn(),
      ...props,
    } as never);
    const buttons = () => [...target.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    return { app, target, buttons, onProperty };
  }

  it('draws a control for each the model gives, grouped with dividers', () => {
    const { target, buttons } = renderControls();
    expect(buttons()).toEqual(expect.arrayContaining(['Fill colour', 'Stroke width', 'Line style', 'Opacity', 'Text size']));
    expect(target.querySelectorAll('.divider').length).toBeGreaterThan(0);
  });

  // A divider separates; with no colours before the first control there is
  // nothing to separate it from.
  it('starts with a control, not a divider, when there are no colours', () => {
    const { target } = renderControls({
      styles: { fill: 'unavailable', stroke: 'unavailable', color: 'unavailable' },
      controls: (controls as { kind: string }[]).filter((control) => control.kind !== 'colour'),
    });
    expect(target.querySelector('.toolbar')!.firstElementChild!.classList.contains('divider')).toBe(false);
  });

  it('divides the colours from the first control after them', () => {
    const { target } = renderControls();
    const children = [...target.querySelector('.toolbar')!.children];
    expect(children[1].classList.contains('divider')).toBe(true);
  });

  // Leaving the row is only half of it: what left has to arrive somewhere, or
  // the control is simply gone at a narrow window.
  it('moves what does not fit into More, and hands More what left', () => {
    const onMore = vi.fn();
    const { target, buttons } = renderControls({ capacity: 3, onMore });
    const shown = buttons();
    expect(shown).toContain('Fill colour');
    expect(shown).not.toContain('Text size');
    expect(shown).toContain('More actions');

    [...target.querySelectorAll('button')]
      .find((b) => b.getAttribute('aria-label') === 'More actions')!
      .click();
    const overflow = onMore.mock.calls[0][1] as { id: string }[];
    expect(overflow.map((control) => control.id)).toContain('fontSize');
    // And the menu that opens offers it, so the control is still reachable.
    expect(ids(overflowMenu(overflow as never))).toContain('property:fontSize▸');
  });
});

// A button for each line action, reported by name.
describe("SelectionToolbar's line actions", () => {
  it('shows each one it is given and reports it when pressed', () => {
    const onLine = vi.fn();
    const { button } = setup({ lineActions: ['finishLine', 'closeLine'], onLine });
    button('Done')!.click();
    button('Close line')!.click();
    expect(onLine.mock.calls.map((call) => call[0])).toEqual(['finishLine', 'closeLine']);
    expect(button('Edit points')).toBeUndefined();
  });
});
