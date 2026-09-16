// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';

// The binding calls into Go, which does not exist in a test process.
vi.mock('../bindings/github.com/tenesh/bava/internal/app', () => ({
  RenderService: {
    Render: vi.fn().mockResolvedValue({ svg: '<svg id="stub"/>', errors: [], nodeMap: {} }),
  },
}));

import App from './App.svelte';

describe('App', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => vi.clearAllMocks());

  // Mounting is the only way to catch an orphaned $effect: creating one inside
  // onMount type-checks cleanly and throws at runtime. This test fails if the
  // effects move back into the mount callback.
  it('mounts without orphaning an effect', () => {
    const target = document.createElement('div');
    document.body.append(target);

    const app = mount(App, { target });

    // The shell replaced Milestone 1's two-pane layout; panes are labelled
    // from the message catalogue now.
    expect(target.querySelector('[aria-label="Document"]')).not.toBeNull();
    expect(target.querySelector('[aria-label="Diagram"]')).not.toBeNull();
    expect(target.querySelector('[aria-label="Files"]')).not.toBeNull();

    unmount(app);
  });

  it('mounts the editor into the source pane', () => {
    const target = document.createElement('div');
    document.body.append(target);

    // onMount runs when effects flush, not during mount() itself.
    const app = flushSync(() => mount(App, { target }));

    // CodeMirror creates its own DOM inside the element it was handed.
    expect(target.querySelector('.cm-editor')).not.toBeNull();

    unmount(app);
  });
});

describe('App shell integration', () => {
  // A view switch must not unmount the editor: CodeMirror owns its own DOM,
  // and remounting it would take the undo history and cursor with it.
  it('keeps the editor mounted when the canvas is hidden', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = flushSync(() => mount(App, { target }));

    const editorBefore = target.querySelector('.cm-editor');
    expect(editorBefore).not.toBeNull();

    const documentButton = [...target.querySelectorAll('button, label')].find((el) =>
      el.textContent?.trim().startsWith('Document'),
    );
    expect(documentButton, 'no Document view control found').toBeDefined();
    flushSync(() => (documentButton as HTMLElement).click());

    // Same node, not a replacement.
    expect(target.querySelector('.cm-editor')).toBe(editorBefore);

    unmount(app);
  });

  it('renders the status bar', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = flushSync(() => mount(App, { target }));
    expect(target.textContent).toContain('Engine');
    unmount(app);
  });
});
