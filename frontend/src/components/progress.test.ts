// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Progress from './Progress.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: { label: string; value: number | null }) {
  const target = document.createElement('div');
  document.body.append(target);
  const app = flushSync(() => mount(Progress, { target, props }));
  return { target, app };
}

describe('Progress', () => {
  // Nothing at startup reports real progress: a fixed percentage would lie.
  it('is indeterminate with no value, and named', () => {
    const { target, app } = render({ label: 'Starting', value: null });
    const bar = target.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar?.hasAttribute('aria-valuenow')).toBe(false);
    expect(target.querySelector('[data-part="range"]')?.getAttribute('data-state')).toBe('indeterminate');
    expect(bar?.getAttribute('aria-label') ?? target.textContent).toContain('Starting');
    unmount(app);
  });

  it('reports a value when it has one', () => {
    const { target, app } = render({ label: 'Downloading', value: 40 });
    expect(target.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40');
    unmount(app);
  });
});
