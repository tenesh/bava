// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import ToolRail from './ToolRail.svelte';
import RailHarness from './__fixtures__/RailHarness.svelte';

function setup(props: Partial<{ active: string; insertOpen: boolean }> = {}) {
  const onSelect = vi.fn();
  const onInsert = vi.fn();
  const { target, app } = render(ToolRail, { active: 'select', insertOpen: false, onSelect, onInsert, ...props } as never);
  const buttons = [...target.querySelectorAll('button')];
  const named = (name: string) => buttons.find((b) => b.getAttribute('aria-label') === name)!;
  return { app, target, buttons, named, onSelect, onInsert };
}

describe('ToolRail', () => {
  it('renders a named, keyed icon button per tool, in a vertical toolbar', () => {
    const { target, buttons, named } = setup();
    expect(target.querySelector('[role="toolbar"]')?.getAttribute('aria-orientation')).toBe('vertical');
    // Insert, seven common tools, frame, code, the eraser and the tool lock.
    expect(buttons).toHaveLength(12);
    expect(named('Rectangle').querySelector('.key')?.textContent).toBe('R');
    expect(named('Rectangle').querySelector('svg')).not.toBeNull();
  });

  it('reports the tool clicked, and presses the active one', () => {
    const { named, onSelect } = setup({ active: 'ellipse' });
    expect(named('Ellipse').getAttribute('aria-pressed')).toBe('true');
    expect(named('Rectangle').getAttribute('aria-pressed')).toBe('false');
    named('Eraser').click();
    expect(onSelect).toHaveBeenCalledWith('eraser');
  });

  it('presses nothing for a shape chosen from the insert panel', () => {
    const { buttons } = setup({ active: 'cloud' });
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(0);
  });

  it('opens insert', () => {
    const closed = setup();
    closed.named('Insert').click();
    expect(closed.onInsert).toHaveBeenCalled();
  });

  it('shows close while insert is open', () => {
    const open = setup({ insertOpen: true });
    expect(open.named('Close insert panel')).toBeDefined();
    expect(open.named('Close insert panel').getAttribute('aria-expanded')).toBe('true');
  });

  it('moves focus with the arrow keys', () => {
    const { buttons } = setup();
    buttons[1].focus();
    buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(buttons[2]);
    buttons[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(buttons[1]);
  });
});

describe('ToolRail focus', () => {
  // Closing the insert panel returns focus to +, from inside the rail rather
  // than by the page searching for the rail's markup.
  it('focuses + when the insert panel closes', () => {
    const harness = render(RailHarness).app as unknown as { setOpen(open: boolean): void };
    flushSync(() => harness.setOpen(true));
    (document.body as HTMLElement).focus();
    flushSync(() => harness.setOpen(false));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Insert');
  });
});

// The rail's tool lock, as Excalidraw's.
describe("ToolRail's lock", () => {
  it('shows whether the tool is kept, and reports a press', () => {
    const onLock = vi.fn();
    const props = { active: 'select', insertOpen: false, onSelect: vi.fn(), onInsert: vi.fn(), locked: true, onLock };
    const { target } = render(ToolRail, props as never);
    const lock = [...target.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Keep tool after drawing')!;
    expect(lock.getAttribute('aria-pressed')).toBe('true');
    lock.click();
    expect(onLock).toHaveBeenCalledOnce();
  });
});
