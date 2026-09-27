// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import SectionTabs from './SectionTabs.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

const body = (text: string) => createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

function render() {
  const target = document.createElement('div');
  document.body.append(target);
  const app = flushSync(() =>
    mount(SectionTabs, {
      target,
      props: {
        label: 'Settings',
        heading: 'Settings',
        sections: [
          { value: 'files', label: 'Files', icon: 'folder', content: body('files body') },
          { value: 'advanced', label: 'Advanced', icon: 'code', content: body('advanced body') },
        ],
      } as never,
    }),
  );
  return { app, target };
}

describe('SectionTabs', () => {
  it('heads the list, and gives each section an icon before its name', () => {
    const { app, target } = render();
    expect(target.querySelector('.bava-section-heading')?.textContent).toBe('Settings');
    const tabs = [...target.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Files', 'Advanced']);
    for (const tab of tabs) {
      const svg = tab.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute('aria-hidden')).toBe('true');
    }
    unmount(app);
  });

  // The right pane names the section shown, which the list's heading does not.
  it('names each section at the top of its panel', () => {
    const { app, target } = render();
    const panels = [...target.querySelectorAll('[role="tabpanel"]')];
    expect(panels.map((panel) => panel.querySelector('h2')?.textContent)).toEqual(['Files', 'Advanced']);
    unmount(app);
  });
});
