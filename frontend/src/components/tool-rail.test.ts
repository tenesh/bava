// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ToolRail from './ToolRail.svelte';
import RailHarness from './fixtures/RailHarness.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: Partial<{ active: string; insertOpen: boolean }> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const onSelect = vi.fn();
  const onInsert = vi.fn();
  const app = flushSync(() =>
    mount(ToolRail, {
      target,
      props: { active: 'select', insertOpen: false, onSelect, onInsert, ...props } as never,
    }),
  );
  const buttons = [...target.querySelectorAll('button')];
  const named = (name: string) => buttons.find((b) => b.getAttribute('aria-label') === name)!;
  return { app, target, buttons, named, onSelect, onInsert };
}

describe('ToolRail', () => {
  it('renders a named, keyed icon button per tool, in a vertical toolbar', () => {
    const { app, target, buttons, named } = render();
    expect(target.querySelector('[role="toolbar"]')?.getAttribute('aria-orientation')).toBe('vertical');
    // Insert, seven common tools, frame, code and the eraser.
    expect(buttons).toHaveLength(11);
    expect(named('Rectangle').querySelector('.key')?.textContent).toBe('R');
    expect(named('Rectangle').querySelector('svg')).not.toBeNull();
    unmount(app);
  });

  it('reports the tool clicked, and presses the active one', () => {
    const { app, named, onSelect } = render({ active: 'ellipse' });
    expect(named('Ellipse').getAttribute('aria-pressed')).toBe('true');
    expect(named('Rectangle').getAttribute('aria-pressed')).toBe('false');
    named('Eraser').click();
    expect(onSelect).toHaveBeenCalledWith('eraser');
    unmount(app);
  });

  it('presses nothing for a shape chosen from the insert panel', () => {
    const { app, buttons } = render({ active: 'cloud' });
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(0);
    unmount(app);
  });

  it('opens insert, which shows close while open', () => {
    const closed = render();
    closed.named('Insert').click();
    expect(closed.onInsert).toHaveBeenCalled();
    unmount(closed.app);

    const open = render({ insertOpen: true });
    expect(open.named('Close insert panel')).toBeDefined();
    expect(open.named('Close insert panel').getAttribute('aria-expanded')).toBe('true');
    unmount(open.app);
  });

  it('moves focus with the arrow keys', () => {
    const { app, buttons } = render();
    buttons[1].focus();
    buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(buttons[2]);
    buttons[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(buttons[1]);
    unmount(app);
  });
});

describe('ToolRail focus', () => {
  // Closing the insert panel returns focus to +, from inside the rail rather
  // than by the page searching for the rail's markup.
  it('focuses + when the insert panel closes', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const harness = flushSync(() => mount(RailHarness, { target })) as unknown as { setOpen(open: boolean): void };
    flushSync(() => harness.setOpen(true));
    (document.body as HTMLElement).focus();
    flushSync(() => harness.setOpen(false));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Insert');
    unmount(harness as never);
  });
});
