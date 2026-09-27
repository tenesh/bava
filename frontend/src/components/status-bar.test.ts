// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import StatusBar from './StatusBar.svelte';

let mounted: ReturnType<typeof mount> | undefined;

function render(props: { errors: number; space?: string; path?: string; engine?: string; nodes?: number; words?: number; characters?: number; message?: string }) {
  const target = document.createElement('div');
  document.body.append(target);
  mounted = flushSync(() => mount(StatusBar, { target, props }));
  return target;
}

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

const items = (target: HTMLElement) => [...target.querySelectorAll('.item')].map((el) => el.textContent?.trim());

describe('StatusBar', () => {
  it('shows the Space and the page path as two items', () => {
    const target = render({ errors: 0, space: 'Acme', path: 'Marketing/Launch plan.md' });
    expect(items(target)).toEqual(['Acme', 'Marketing/Launch plan.md']);
  });

  it('says nothing about errors when there are none', () => {
    const target = render({ errors: 0, engine: 'tala', nodes: 3 });
    expect(target.textContent).not.toContain('Errors');
  });

  it('counts errors when there are some', () => {
    const target = render({ errors: 2 });
    const errors = target.querySelector('.has-errors');
    expect(errors?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Errors 2');
  });

  // A document shows its words and characters, as the mockup has it.
  it('counts a document\'s words and characters', () => {
    const target = render({ errors: 0, space: 'Acme', words: 1184, characters: 7021 });
    expect(items(target)).toEqual(['Acme', '1,184 words', '7,021 characters']);
  });

  it('says one word, not one words', () => {
    const target = render({ errors: 0, words: 1, characters: 4 });
    expect(items(target)).toContain('1 word');
  });
});
