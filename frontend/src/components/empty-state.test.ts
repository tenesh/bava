// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '../test/render';
import EmptyState from './EmptyState.svelte';

function setup(props: { title: string; body?: string; mark?: boolean; hints?: { keys: string; label: string }[] }) {
  const { target, app } = render(EmptyState, props);
  return { target, app };
}

describe('EmptyState', () => {
  it('shows no mark unless asked', () => {
    const plain = setup({ title: 'Nothing here' });
    expect(plain.target.querySelector('.mark')).toBeNull();
  });

  it('shows the faded mark when asked', () => {
    const branded = setup({ title: 'No folder open', mark: true });
    const mark = branded.target.querySelector('.mark');
    expect(mark).not.toBeNull();
    expect(mark?.getAttribute('data-size')).toBe('hero');
    // Decorative: the title already says what the state is.
    expect(branded.target.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(branded.target.querySelector('.faded')).not.toBeNull();
  });

  it('lists key hints when given, each key beside its action', () => {
    const { target } = setup({
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
  });
});
