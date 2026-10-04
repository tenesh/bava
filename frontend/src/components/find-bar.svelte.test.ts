// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import FindBar from './FindBar.svelte';

function setup() {
  const props = $state({
    count: 0,
    index: -1,
    focus: { field: 'find' as 'find' | 'replace', at: 1 },
    onFind: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onReplace: vi.fn(),
    onReplaceAll: vi.fn(),
    onClose: vi.fn(),
  });
  const { target } = render(FindBar, props);
  const [find, replace] = target.querySelectorAll('input');
  const button = (name: string) => target.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
  const position = () => target.querySelector('.position')!.textContent;
  return { props, find, replace, button, position };
}

describe('FindBar', () => {
  it('takes focus in its find field when it opens, so typing searches and never edits the page', () => {
    const { find } = setup();
    expect(document.activeElement).toBe(find);
  });

  it('moves focus to the field asked for, each time it is asked', () => {
    const { props, find, replace } = setup();
    flushSync(() => (props.focus = { field: 'replace', at: 2 }));
    expect(document.activeElement).toBe(replace);
    flushSync(() => (props.focus = { field: 'find', at: 3 }));
    expect(document.activeElement).toBe(find);
  });

  it('searches what is typed, and counts the matches it is told of', () => {
    const { props, find, button, position } = setup();
    find.value = 'plan';
    flushSync(() => find.dispatchEvent(new Event('input', { bubbles: true })));
    expect(props.onFind).toHaveBeenLastCalledWith('plan');
    flushSync(() => {
      props.count = 3;
      props.index = 0;
    });
    expect(position()).toBe('1 of 3');
    expect(button('Previous match').disabled).toBe(false);
    expect(button('Next match').disabled).toBe(false);
  });

  it('says when nothing matches, with nowhere to move to', () => {
    const { find, button, position } = setup();
    find.value = 'zzz';
    flushSync(() => find.dispatchEvent(new Event('input', { bubbles: true })));
    expect(position()).toBe('No matches');
    expect(button('Previous match').disabled).toBe(true);
    expect(button('Next match').disabled).toBe(true);
  });
});
