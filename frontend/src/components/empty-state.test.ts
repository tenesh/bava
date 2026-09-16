// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import EmptyState from './EmptyState.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: { title: string; body?: string; mark?: boolean }) {
  const target = document.createElement('div');
  document.body.append(target);
  const app = flushSync(() => mount(EmptyState, { target, props }));
  return { target, app };
}

describe('EmptyState', () => {
  it('empty state shows the faded mark when asked, and not otherwise', () => {
    const plain = render({ title: 'Nothing here' });
    expect(plain.target.querySelector('.mark')).toBeNull();
    unmount(plain.app);

    const branded = render({ title: 'No folder open', mark: true });
    const mark = branded.target.querySelector('.mark');
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('data-size')).toBe('hero');
    // Decorative: the title already says what the state is.
    expect(branded.target.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(branded.target.querySelector('.faded')).not.toBeNull();
    unmount(branded.app);
  });
});
