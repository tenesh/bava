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

    expect(target.querySelector('[aria-label="D2 source"]')).not.toBeNull();
    expect(target.querySelector('[aria-label="Diagram"]')).not.toBeNull();

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
