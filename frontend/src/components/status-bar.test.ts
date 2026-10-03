// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '../test/render';
import StatusBar from './StatusBar.svelte';

function setup(props: { space?: string; path?: string; engine?: string; nodes?: number; words?: number; characters?: number; message?: string }) {
  const { target } = render(StatusBar, props);
  return target;
}

const items = (target: HTMLElement) => [...target.querySelectorAll('.item')].map((el) => el.textContent?.trim());

describe('StatusBar', () => {
  it('shows the Space and the page path as two items', () => {
    const target = setup({ space: 'Acme', path: 'Marketing/Launch plan.md' });
    expect(items(target)).toEqual(['Acme', 'Marketing/Launch plan.md']);
  });

  // A document shows its words and characters, as the mockup has it.
  it('counts a document\'s words and characters', () => {
    const target = setup({ space: 'Acme', words: 1184, characters: 7021 });
    expect(items(target)).toEqual(['Acme', '1,184 words', '7,021 characters']);
  });

  it('says one word, not one words', () => {
    const target = setup({ words: 1, characters: 4 });
    expect(items(target)).toContain('1 word');
  });
});
