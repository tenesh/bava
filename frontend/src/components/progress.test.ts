// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '../test/render';
import Progress from './Progress.svelte';

function setup(props: { label: string; value: number | null }) {
  const { target, app } = render(Progress, props);
  return { target, app };
}

describe('Progress', () => {
  // Nothing at startup reports real progress: a fixed percentage would lie.
  it('is indeterminate with no value, and named', () => {
    const { target } = setup({ label: 'Starting', value: null });
    const bar = target.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar?.hasAttribute('aria-valuenow')).toBe(false);
    expect(target.querySelector('[data-part="range"]')?.getAttribute('data-state')).toBe('indeterminate');
    expect(bar?.getAttribute('aria-label') ?? target.textContent).toContain('Starting');
  });

  it('reports a value when it has one', () => {
    const { target } = setup({ label: 'Downloading', value: 40 });
    expect(target.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40');
  });
});
