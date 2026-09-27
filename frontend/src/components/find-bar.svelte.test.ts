// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import FindBar from './FindBar.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

function render() {
  const target = document.createElement('div');
  document.body.append(target);
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
  mounted = flushSync(() => mount(FindBar, { target, props }));
  const [find, replace] = target.querySelectorAll('input');
  return { props, find, replace };
}

describe('FindBar', () => {
  it('takes focus in its find field when it opens, so typing searches and never edits the page', () => {
    const { find } = render();
    expect(document.activeElement).toBe(find);
  });

  it('moves focus to the field asked for, each time it is asked', () => {
    const { props, find, replace } = render();
    flushSync(() => (props.focus = { field: 'replace', at: 2 }));
    expect(document.activeElement).toBe(replace);
    flushSync(() => (props.focus = { field: 'find', at: 3 }));
    expect(document.activeElement).toBe(find);
  });
});
