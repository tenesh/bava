// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Splash from './Splash.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Splash', () => {
  it('shows the mark, the wordmark, an indeterminate bar and the status', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = flushSync(() => mount(Splash, { target, props: { status: 'Starting' } }));

    const splash = target.querySelector('[data-part="splash"]');
    expect(splash).not.toBeNull();
    expect(splash?.getAttribute('aria-busy')).toBe('true');
    expect(target.querySelector('.mark')?.getAttribute('data-size')).toBe('splash');
    expect(target.textContent).toContain('bava');
    expect(target.textContent).toContain('Starting');
    expect(target.textContent).toContain('Apache-2.0');
    expect(target.querySelector('[role="progressbar"]')?.hasAttribute('aria-valuenow')).toBe(false);
    unmount(app);
  });
});
