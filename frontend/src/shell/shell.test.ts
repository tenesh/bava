// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from '../test/render';
import Shell from './Shell.svelte';
import { createViewState } from './view.svelte';

const pane = (text: string) => createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

function setup() {
  const memory = new Map<string, string>();
  const view = createViewState({
    storage: { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => void memory.set(key, value) },
  });
  view.toggleAI();
  const { target } = render(Shell, {
    open: true,
    title: 'Home',
    themeChoice: 'system',
    onChooseTheme: () => {},
    pageWidth: 'narrow',
    onPageWidth: () => {},
    document: pane('page'),
    canvas: pane('scene'),
    view,
  });
  return target.querySelector<HTMLElement>('.region-ai')!;
}

describe('Shell', () => {
  // The empty canvas's words describe another pane.
  it('says in the AI pane what the AI pane holds, not that the canvas is empty', () => {
    const ai = setup();
    expect(ai.textContent).not.toContain('Nothing on the canvas');
    expect(ai.textContent).toContain('No AI yet');
  });
});
