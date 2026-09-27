// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import Pane from './Pane.svelte';

let mounted: ReturnType<typeof mount> | undefined;

const children = createRawSnippet(() => ({ render: () => '<p>body</p>' }));

function render(props: { title: string; variant?: 'titled' | 'bare' }) {
  const target = document.createElement('div');
  document.body.append(target);
  mounted = flushSync(() => mount(Pane, { target, props: { ...props, children } }));
  return target;
}

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

describe('Pane', () => {
  it('shows its title in a header by default', () => {
    const target = render({ title: 'AI' });
    expect(target.querySelector('.header')?.textContent).toContain('AI');
  });

  it('drops the header when bare, and keeps the title as its name', () => {
    const target = render({ title: 'Document', variant: 'bare' });
    expect(target.querySelector('.header')).toBeNull();
    expect(target.querySelector('section')?.getAttribute('aria-label')).toBe('Document');
    expect(target.textContent).toContain('body');
  });
});
