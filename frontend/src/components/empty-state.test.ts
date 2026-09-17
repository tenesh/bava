// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import EmptyState from './EmptyState.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

function render(props: { title: string; body?: string; mark?: boolean; hints?: { keys: string; label: string }[] }) {
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

  it('lists key hints when given, each key beside its action', () => {
    const { target, app } = render({
      title: 'No file open',
      mark: true,
      hints: [
        { keys: '⌘O', label: 'Open a file' },
        { keys: '⌘N', label: 'New file' },
      ],
    });
    const rows = [...target.querySelectorAll('li')];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('kbd')?.textContent).toBe('⌘O');
    expect(rows[0].textContent).toContain('Open a file');
    expect(rows[1].querySelector('kbd')?.textContent).toBe('⌘N');
    unmount(app);
  });
});
