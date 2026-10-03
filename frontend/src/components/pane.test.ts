// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from '../test/render';
import Pane from './Pane.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>body</p>' }));

function setup(props: { title: string; variant?: 'titled' | 'bare' }) {
  const { target } = render(Pane, { ...props, children });
  return target;
}

describe('Pane', () => {
  it('shows its title in a header by default', () => {
    const target = setup({ title: 'AI' });
    expect(target.querySelector('.header')?.textContent).toContain('AI');
  });

  it('drops the header when bare, and keeps the title as its name', () => {
    const target = setup({ title: 'Document', variant: 'bare' });
    expect(target.querySelector('.header')).toBeNull();
    expect(target.querySelector('section')?.getAttribute('aria-label')).toBe('Document');
    expect(target.textContent).toContain('body');
  });
});
