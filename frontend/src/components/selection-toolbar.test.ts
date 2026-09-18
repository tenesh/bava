// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import SelectionToolbar from './SelectionToolbar.svelte';
import { overflowMenu, type MenuNode } from '../canvas/context-menu';

const ids = (nodes: MenuNode[]): string[] =>
  nodes.map((node) => (node.kind === 'separator' ? '—' : node.kind === 'submenu' ? `${node.id}▸` : node.id));

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.append(target);
  const onApply = vi.fn();
  const onCommand = vi.fn();
  const onMore = vi.fn();
  const app = flushSync(() =>
    mount(SelectionToolbar, {
      target,
      props: {
        styles: { fill: null, stroke: 'blue', color: 'unavailable' },
        align: false,
        distribute: false,
        onApply,
        onCommand,
        onMore,
        ...props,
      } as never,
    }),
  );
  const button = (name: string) => [...target.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === name);
  return { app, target, button, onApply, onCommand, onMore };
}

describe('SelectionToolbar', () => {
  it('shows the colour pickers that apply and More, without align for one unit', () => {
    const { app, button } = render({});
    expect(button('Fill colour')).toBeDefined();
    expect(button('Border colour')).toBeDefined();
    expect(button('Text colour')).toBeUndefined();
    expect(button('Align left')).toBeUndefined();
    expect(button('More actions')).toBeDefined();
    unmount(app);
  });

  it('shows align buttons for two units and distribute for three, reporting the command', () => {
    const two = render({ align: true });
    expect(two.button('Distribute horizontally')).toBeUndefined();
    two.button('Align left')!.click();
    expect(two.onCommand).toHaveBeenCalledWith('canvas.alignLeft');
    unmount(two.app);

    const three = render({ align: true, distribute: true });
    three.button('Distribute vertically')!.click();
    expect(three.onCommand).toHaveBeenCalledWith('canvas.distributeVertical');
    unmount(three.app);
  });

  it('reports More with where it is, so the menu can open there', () => {
    const { app, button, onMore } = render({});
    button('More actions')!.click();
    // Where it sits, and what did not fit into the row.
    expect(onMore).toHaveBeenCalledWith(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }), []);
    unmount(app);
  });
});

// The row shows the controls the model gives it, and moves what does not fit
// into More (canvas-toolbar.md).
describe('SelectionToolbar controls', () => {
  const controls = [
    { id: 'fill', group: 'colour', kind: 'colour' },
    { id: 'strokeWidth', group: 'stroke', kind: 'options' },
    { id: 'strokeStyle', group: 'stroke', kind: 'options' },
    { id: 'opacity', group: 'stroke', kind: 'slider' },
    { id: 'fontSize', group: 'label', kind: 'options' },
  ] as never;

  function renderControls(props: Record<string, unknown> = {}) {
    const target = document.createElement('div');
    document.body.append(target);
    const onProperty = vi.fn();
    const app = flushSync(() =>
      mount(SelectionToolbar, {
        target,
        props: {
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
        } as never,
      }),
    );
    const buttons = () => [...target.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    return { app, target, buttons, onProperty };
  }

  it('draws a control for each the model gives, grouped with dividers', () => {
    const { app, target, buttons } = renderControls();
    expect(buttons()).toEqual(expect.arrayContaining(['Fill colour', 'Stroke width', 'Line style', 'Opacity', 'Text size']));
    expect(target.querySelectorAll('.divider').length).toBeGreaterThan(0);
    unmount(app);
  });

  // Leaving the row is only half of it: what left has to arrive somewhere, or
  // the control is simply gone at a narrow window.
  it('moves what does not fit into More, and hands More what left', () => {
    const onMore = vi.fn();
    const { app, target, buttons } = renderControls({ capacity: 3, onMore });
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
    unmount(app);
  });
});
