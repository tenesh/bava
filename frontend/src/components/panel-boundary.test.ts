// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import BoundaryHarness from './__fixtures__/BoundaryHarness.svelte';

describe('PanelBoundary', () => {
  // A crash in one panel must not take the window with it.
  it('shows the fallback and reports once when a child throws', () => {
    const onError = vi.fn();
    const broken = { value: true };

    const { target } = render(BoundaryHarness, { broken, onError });

    expect(target.querySelector('.child')).toBeNull();
    expect(target.textContent).toContain('This panel hit a problem');
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe('panel exploded');
  });

  it('Reload panel renders the child again', () => {
    const broken = { value: true };
    const { target } = render(BoundaryHarness, { broken, onError: vi.fn() });

    broken.value = false;
    const reload = [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Reload panel');
    flushSync(() => reload!.click());

    expect(target.querySelector('.child')?.textContent).toBe('panel content');
  });
});
