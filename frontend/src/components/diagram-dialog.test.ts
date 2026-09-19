// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import DiagramDialog from './DiagramDialog.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

async function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const onSource = vi.fn();
  const onInsert = vi.fn();
  const onOpenChange = vi.fn();
  const app = flushSync(() =>
    mount(DiagramDialog, {
      target,
      props: {
        open: true,
        source: 'a -> b',
        preview: '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>',
        errors: [],
        pending: false,
        shapes: 2,
        onSource,
        onInsert,
        onOpenChange,
        ...props,
      } as never,
    }),
  );
  await vi.waitFor(() => expect(document.querySelector('.bava-diagram-preview')).not.toBeNull());
  const button = (name: string) =>
    [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === name);
  return { app, button, onSource, onInsert, onOpenChange };
}

describe('DiagramDialog', () => {
  it('shows the preview it is handed', async () => {
    const { app } = await render();
    expect(document.querySelector('.bava-diagram-preview')!.innerHTML).toContain('<svg');
    unmount(app);
  });

  it('mounts an editor for the source, and takes it away again', async () => {
    const { app } = await render();
    expect(document.querySelector('.cm-editor')).not.toBeNull();
    unmount(app);
    expect(document.querySelector('.cm-editor')).toBeNull();
  });

  it('inserts what is previewed', async () => {
    const { app, button, onInsert } = await render();
    button('Insert')!.click();
    expect(onInsert).toHaveBeenCalled();
    unmount(app);
  });

  // Nothing to insert, and nothing that would arrive as an empty diagram.
  // The preview describes the previous source until the render lands, so
  // inserting during that window would insert the wrong diagram.
  it('cannot insert while a render is still coming', async () => {
    const { app, button } = await render({ pending: true });
    expect(button('Insert')!.disabled).toBe(true);
    unmount(app);
  });

  // A source that compiles to nothing still produces an SVG, so the button
  // cannot key off the preview alone or it does nothing when pressed.
  it('cannot insert a diagram with no shapes in it', async () => {
    const { app, button } = await render({ shapes: 0 });
    expect(button('Insert')!.disabled).toBe(true);
    unmount(app);
  });

  it('cannot insert while the source does not compile, or is empty', async () => {
    const broken = await render({ errors: [{ message: 'expected a name', line: 1, from: 0, to: 1 }] });
    expect(broken.button('Insert')!.disabled).toBe(true);
    expect(document.body.textContent).toContain('expected a name');
    unmount(broken.app);

    const empty = await render({ source: '   ' });
    expect(empty.button('Insert')!.disabled).toBe(true);
    unmount(empty.app);
  });

  it('reports a cancel, so the caller can close it', async () => {
    const { app, button, onOpenChange } = await render();
    button('Cancel')!.click();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount(app);
  });
});

// Ark keeps a dialog's content mounted unless told otherwise, so without
// `unmountOnExit` the editor survives a close: reopening showed the previous
// source while the preview had been reset, and Insert inserted the wrong one.
describe('closing and reopening', () => {
  it('builds a fresh editor each time it opens', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    // Mounted twice rather than with reactive props: the component is fed by
    // its caller, and what matters here is that a close takes the editor away.
    const open = (source: string) =>
      flushSync(() =>
        mount(DiagramDialog, {
          target,
          props: {
            open: true,
            source,
            preview: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
            errors: [],
            onSource: vi.fn(),
            onInsert: vi.fn(),
            onOpenChange: vi.fn(),
          } as never,
        }),
      );
    const app = open('first -> one');
    await vi.waitFor(() => expect(document.querySelector('.cm-editor')).not.toBeNull());
    expect(document.querySelector('.cm-content')!.textContent).toContain('first');

    unmount(app);
    await vi.waitFor(() => expect(document.querySelector('.cm-editor')).toBeNull());

    const second = open('second -> two');
    await vi.waitFor(() => expect(document.querySelector('.cm-editor')).not.toBeNull());
    expect(document.querySelector('.cm-content')!.textContent).toContain('second');
    unmount(second);
  });
});
