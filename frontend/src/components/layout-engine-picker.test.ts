// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import LayoutEnginePicker from './LayoutEnginePicker.svelte';

function setup(props: Record<string, unknown> = {}) {
  const onEngine = vi.fn();
  const onDirection = vi.fn();
  const { target, app } = render(LayoutEnginePicker, { engine: 'tala', direction: 'down', onEngine, onDirection, ...props } as never);
  const item = (text: string) =>
    [...target.querySelectorAll<HTMLElement>('[data-part="item"]')].find((el) => (el.textContent ?? '').trim() === text);
  return { app, target, item, onEngine, onDirection };
}

// CLAUDE.md: TALA is the default; dagre and elk are alternatives the user
// picks; TALA ignores direction, so no direction control while it is chosen.
describe('LayoutEnginePicker', () => {
  it('offers the three engines', () => {
    const { item } = setup();
    expect(['TALA', 'Dagre', 'ELK'].every((name) => item(name))).toBe(true);
  });

  it('reports an engine choice', () => {
    const { item, onEngine } = setup();
    flushSync(() => item('Dagre')!.click());
    expect(onEngine).toHaveBeenCalledWith('dagre');
  });

  it('hides direction while TALA is chosen', () => {
    const { item } = setup({ engine: 'tala' });
    expect(item('Right')).toBeUndefined();
  });

  it('says why there is no direction while TALA is chosen', () => {
    const tala = setup({ engine: 'tala' });
    expect(tala.target.textContent).toContain('TALA chooses its own direction.');
    const elk = setup({ engine: 'elk' });
    expect(elk.target.textContent).not.toContain('TALA chooses its own direction.');
  });

  it('reports a direction change for another engine', () => {
    const { item, onDirection } = setup({ engine: 'elk' });
    flushSync(() => item('Right')!.click());
    expect(onDirection).toHaveBeenCalledWith('right');
  });
});
