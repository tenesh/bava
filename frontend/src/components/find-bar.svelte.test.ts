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
  return { props, find, replace };
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
});
