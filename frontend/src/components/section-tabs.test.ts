// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from '../test/render';
import SectionTabs from './SectionTabs.svelte';

const body = (text: string) => createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

function setup() {
  const { target, app } = render(SectionTabs, {
    label: 'Settings',
    heading: 'Settings',
    sections: [
      { value: 'files', label: 'Files', icon: 'folder', content: body('files body') },
      { value: 'advanced', label: 'Advanced', icon: 'code', content: body('advanced body') },
    ],
  } as never);
  return { app, target };
}

describe('SectionTabs', () => {
  it('heads the list, and gives each section an icon before its name', () => {
    const { target } = setup();
    expect(target.querySelector('.bava-section-heading')?.textContent).toBe('Settings');
    const tabs = [...target.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Files', 'Advanced']);
    for (const tab of tabs) {
      const svg = tab.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  // The right pane names the section shown, which the list's heading does not.
  it('names each section at the top of its panel', () => {
    const { target } = setup();
    const panels = [...target.querySelectorAll('[role="tabpanel"]')];
    expect(panels.map((panel) => panel.querySelector('h2')?.textContent)).toEqual(['Files', 'Advanced']);
  });
});
