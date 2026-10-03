// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render, unmount } from '../test/render';
import DiagramDialog from './DiagramDialog.svelte';

async function setup(props: Record<string, unknown> = {}) {
  const onSource = vi.fn();
  const onInsert = vi.fn();
  const onOpenChange = vi.fn();
  const { app } = render(DiagramDialog, {
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
  } as never);
  await vi.waitFor(() => expect(document.querySelector('.bava-diagram-preview')).not.toBeNull());
  const button = (name: string) =>
    [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === name);
  return { app, button, onSource, onInsert, onOpenChange };
}

describe('DiagramDialog', () => {
  it('shows the preview it is handed', async () => {
    const preview = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="handed-in" width="4"></rect></svg>';
    await setup({ preview });
    expect(document.querySelector('.bava-diagram-preview')!.innerHTML).toBe(preview);
  });

  it('mounts an editor for the source, and takes it away again', async () => {
    const { app } = await setup();
    expect(document.querySelector('.cm-editor')).not.toBeNull();
    unmount(app);
    expect(document.querySelector('.cm-editor')).toBeNull();
  });

  it('inserts what is previewed', async () => {
    const { button, onInsert } = await setup();
    button('Insert')!.click();
    expect(onInsert).toHaveBeenCalled();
  });

  // Nothing to insert, and nothing that would arrive as an empty diagram.
  // The preview describes the previous source until the render lands, so
  // inserting during that window would insert the wrong diagram.
  it('cannot insert while a render is still coming', async () => {
    const { button } = await setup({ pending: true });
    expect(button('Insert')!.disabled).toBe(true);
  });

  // A source that compiles to nothing still produces an SVG, so the button
  // cannot key off the preview alone or it does nothing when pressed.
  it('cannot insert a diagram with no shapes in it', async () => {
    const { button } = await setup({ shapes: 0 });
    expect(button('Insert')!.disabled).toBe(true);
  });

  it('cannot insert while the source does not compile', async () => {
    const broken = await setup({ errors: [{ message: 'expected a name', line: 1, from: 0, to: 1 }] });
    expect(broken.button('Insert')!.disabled).toBe(true);
    expect(document.body.textContent).toContain('expected a name');
  });

  it('cannot insert an empty source', async () => {
    const empty = await setup({ source: '   ' });
    expect(empty.button('Insert')!.disabled).toBe(true);
  });

  it('says which engine laid the preview out, and how many shapes it holds', async () => {
    await setup({ engine: 'tala', shapes: 3 });
    expect(document.querySelector('.bava-diagram-status')?.textContent).toBe('Laid out by TALA · 3 shapes');
  });

  // The engine choice sits in the footer, beside the buttons it decides.
  it('keeps the engine picker in the footer', async () => {
    await setup({ engine: 'tala' });
    const footer = document.querySelector('.bava-dialog-footer')!;
    expect(footer.textContent).toContain('TALA');
    expect(footer.textContent).toContain('Insert');
  });

  it('reports a cancel, so the caller can close it', async () => {
    const { button, onOpenChange } = await setup();
    button('Cancel')!.click();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// Ark keeps a dialog's content mounted unless told otherwise, so without
// `unmountOnExit` the editor survives a close: reopening showed the previous
// source while the preview had been reset, and Insert inserted the wrong one.
describe('closing and reopening', () => {
  it('builds a fresh editor each time it opens', async () => {
    // Mounted twice rather than with reactive props: the component is fed by
    // its caller, and what matters here is that a close takes the editor away.
    const open = (source: string) =>
      render(DiagramDialog, {
        open: true,
        source,
        preview: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        errors: [],
        onSource: vi.fn(),
        onInsert: vi.fn(),
        onOpenChange: vi.fn(),
      } as never).app;
    const app = open('first -> one');
    await vi.waitFor(() => expect(document.querySelector('.cm-editor')).not.toBeNull());
    expect(document.querySelector('.cm-content')!.textContent).toContain('first');

    unmount(app);
    await vi.waitFor(() => expect(document.querySelector('.cm-editor')).toBeNull());

    open('second -> two');
    await vi.waitFor(() => expect(document.querySelector('.cm-editor')).not.toBeNull());
    expect(document.querySelector('.cm-content')!.textContent).toContain('second');
  });
});

// The dialog has no width of its own by default, so its two panes shrank to
// their content and the code area was a sliver. It asks for the wide size.
describe('the Diagram from Code dialog size', () => {
  it('uses the diagram dialog\'s own size', async () => {
    await setup();
    expect(document.querySelector('.bava-dialog-content')!.getAttribute('data-size')).toBe('diagram');
  });
});

describe('choosing a layout in the dialog', () => {
  it('shows the picker and reports an engine choice', async () => {
    const onEngine = vi.fn();
    await setup({ engine: 'tala', direction: 'down', onEngine, onDirection: vi.fn() });
    const dagre = [...document.querySelectorAll<HTMLElement>('[data-part="item"]')].find((el) => el.textContent?.trim() === 'Dagre');
    flushSync(() => dagre!.click());
    expect(onEngine).toHaveBeenCalledWith('dagre');
  });

  it('says the code wins when a direction can be chosen', async () => {
    await setup({ engine: 'dagre', direction: 'down', onEngine: vi.fn(), onDirection: vi.fn() });
    expect(document.body.textContent).toContain('A direction written in the code wins over this one.');
  });
});

// The menu owns Cmd/Ctrl+Z and friends and routes them to the focused editor;
// an editor that also kept the binding would act twice.
describe('keys the menu reserves', () => {
  it('are dropped by the dialog editor, as by the document pane', async () => {
    await setup({ isReserved: (binding: { key?: string }) => binding.key === 'Mod-z' });
    const { EditorView } = await import('@codemirror/view');
    const view = EditorView.findFromDOM(document.querySelector('.bava-dialog-content .cm-editor') as HTMLElement)!;
    view.dispatch({ changes: { from: view.state.doc.length, insert: '!' } });
    view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', keyCode: 90, ctrlKey: true, bubbles: true, cancelable: true }));
    expect(view.state.doc.toString()).toBe('a -> b!');
  });
});
