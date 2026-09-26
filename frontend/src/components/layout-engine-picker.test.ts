// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import LayoutEnginePicker from './LayoutEnginePicker.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const onEngine = vi.fn();
  const onDirection = vi.fn();
  const app = flushSync(() =>
    mount(LayoutEnginePicker, { target, props: { engine: 'tala', direction: 'down', onEngine, onDirection, ...props } as never }),
  );
  const item = (text: string) =>
    [...target.querySelectorAll<HTMLElement>('[data-part="item"]')].find((el) => (el.textContent ?? '').trim() === text);
  return { app, target, item, onEngine, onDirection };
}

// CLAUDE.md: TALA is the default; dagre and elk are alternatives the user
// picks; TALA ignores direction, so no direction control while it is chosen.
describe('LayoutEnginePicker', () => {
  it('offers the three engines', () => {
    const { app, item } = render();
    expect(['TALA', 'Dagre', 'ELK'].every((name) => item(name))).toBe(true);
    unmount(app);
  });

  it('reports an engine choice', () => {
    const { app, item, onEngine } = render();
    flushSync(() => item('Dagre')!.click());
    expect(onEngine).toHaveBeenCalledWith('dagre');
    unmount(app);
  });

  it('hides direction while TALA is chosen', () => {
    const { app, item } = render({ engine: 'tala' });
    expect(item('Right')).toBeUndefined();
    unmount(app);
  });

  it('reports a direction change for another engine', () => {
    const { app, item, onDirection } = render({ engine: 'elk' });
    flushSync(() => item('Right')!.click());
    expect(onDirection).toHaveBeenCalledWith('right');
    unmount(app);
  });
});
