// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import BoundaryHarness from './fixtures/BoundaryHarness.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('PanelBoundary', () => {
  // A crash in one panel must not take the window with it.
  it('shows the fallback and reports once when a child throws', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const onError = vi.fn();
    const broken = { value: true };

    const app = flushSync(() => mount(BoundaryHarness, { target, props: { broken, onError } }));

    expect(target.querySelector('.child')).toBeNull();
    expect(target.textContent).toContain('This panel hit a problem');
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe('panel exploded');
    unmount(app);
  });

  it('Reload panel renders the child again', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const broken = { value: true };
    const app = flushSync(() => mount(BoundaryHarness, { target, props: { broken, onError: vi.fn() } }));

    broken.value = false;
    const reload = [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Reload panel');
    flushSync(() => reload!.click());

    expect(target.querySelector('.child')?.textContent).toBe('panel content');
    unmount(app);
  });
});
