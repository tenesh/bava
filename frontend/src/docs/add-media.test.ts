// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';
import { DocEditor } from './editor';
import { addMedia, type AddMediaDeps } from './add-media';
import { SLASH_ITEMS } from './slash';
import { atTextEnd } from './test-caret';

// jsdom lays nothing out: a range has no boxes to scroll a selection into view by.
for (const name of ['getClientRects', 'getBoundingClientRect'] as const) {
  if (!(name in Range.prototype)) {
    Object.defineProperty(Range.prototype, name, { value: name === 'getClientRects' ? () => [] : () => new DOMRect(), configurable: true });
  }
}

function deps(over: Partial<AddMediaDeps> = {}): AddMediaDeps {
  return {
    inSpace: () => true,
    offerSpace: vi.fn(async () => true),
    attach: vi.fn(async (file) => ({ name: 'path' in file ? file.path.slice(file.path.lastIndexOf('/') + 1) : 'Pasted image 2026-09-29 14.32.05.png' })),
    insert: vi.fn(),
    notify: vi.fn(),
    ...over,
  };
}

describe('adding images and videos to a page', () => {
  it('copies each file into the attachments and adds them together, in order', async () => {
    const d = deps();
    await addMedia([{ path: '/Desktop/logo.png' }, { path: '/Desktop/demo.mp4' }], d);
    expect(d.attach).toHaveBeenCalledTimes(2);
    expect(d.insert).toHaveBeenCalledWith(['logo.png', 'demo.mp4']);
  });

  it('leaves out files that are not images or videos, and does nothing when none is', async () => {
    const d = deps();
    await addMedia([{ path: '/Desktop/notes.pdf' }, { path: '/Desktop/logo.PNG' }], d);
    expect(d.attach).toHaveBeenCalledTimes(1);
    expect(d.insert).toHaveBeenCalledWith(['logo.PNG']);
    const none = deps({ inSpace: () => false });
    await addMedia([{ path: '/Desktop/notes.pdf' }], none);
    expect(none.offerSpace).not.toHaveBeenCalled();
    expect(none.insert).not.toHaveBeenCalled();
  });

  it('on a page opened on its own, first offers to open its folder as a Space', async () => {
    const accepted = deps({ inSpace: () => false });
    await addMedia([{ path: '/Desktop/logo.png' }], accepted);
    expect(accepted.offerSpace).toHaveBeenCalled();
    expect(accepted.insert).toHaveBeenCalledWith(['logo.png']);
  });

  it('adds nothing when that offer is declined', async () => {
    const declined = deps({ inSpace: () => false, offerSpace: vi.fn(async () => false) });
    await addMedia([{ data: 'cG5n' }], declined);
    expect(declined.attach).not.toHaveBeenCalled();
    expect(declined.insert).not.toHaveBeenCalled();
  });

  it('says which could not be added, and adds the rest', async () => {
    const d = deps({
      attach: vi.fn(async (file) => ('path' in file && file.path.endsWith('bad.png') ? { error: 'denied' } : { name: 'good.png' })),
    });
    await addMedia([{ path: '/bad.png' }, { path: '/good.png' }], d);
    expect(d.notify).toHaveBeenCalledWith('denied');
    expect(d.insert).toHaveBeenCalledWith(['good.png']);
  });
});

describe('the / menu', () => {
  it('offers Image and Video, which ask the app for files', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const onChooseMedia = vi.fn();
    editor = new DocEditor();
    editor.mount(host, { onChange: vi.fn(), onChooseMedia });
    editor.setPage('Text\n');
    const view = editor.view!;
    for (const kind of ['image', 'video']) {
      view.dispatch(view.state.tr.setSelection(atTextEnd(view.state.doc)).insertText(' /'));
      editor.chooseSlash(kind);
      expect(onChooseMedia).toHaveBeenLastCalledWith(kind);
    }
    expect(SLASH_ITEMS.find((item) => item.id === 'image')?.group).toBe('advanced');
  });
});

let editor: DocEditor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function open(markdown: string, here = 'Page.md') {
  const host = document.createElement('div');
  document.body.append(host);
  const options = { onChange: vi.fn(), onPasteImage: vi.fn(), probeFile: async () => true };
  editor = new DocEditor();
  editor.mount(host, options);
  editor.setPage(markdown);
  editor.setSpacePages(here, []);
  return { ...options, view: editor.view! };
}

/** Puts the caret just after the first `text` in the page. */
function caretAfter(text: string) {
  const view = editor!.view!;
  let at = -1;
  view.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text!.includes(text)) at = pos + node.text!.indexOf(text) + text.length;
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
}

describe('media blocks going into the page', () => {
  it('replace an empty line the caret is on, each as a block named after its file, as one edit', () => {
    const { view } = open('Before\n\nAfter\n');
    // An empty line between the two, the caret on it.
    view.dispatch(view.state.tr.insert(8, view.state.schema.nodes.paragraph.create()));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 9)));
    const blocks = view.state.doc.childCount;
    editor!.insertMedia(['logo mark.png', 'demo.mp4']);
    expect(view.state.doc.childCount).toBe(blocks + 1);
    expect(editor!.markdown()).toBe('Before\n\n![logo mark](.bava/attachments/logo%20mark.png)\n\n![demo](.bava/attachments/demo.mp4)\n\nAfter\n');
    editor!.undo();
    const kinds: string[] = [];
    view.state.doc.forEach((node) => kinds.push(node.type.name));
    expect(kinds).not.toContain('image');
    expect(kinds).not.toContain('video');
  });

  it('split the line the caret is in', () => {
    open('OneTwo\n');
    caretAfter('One');
    editor!.insertMedia(['a.png']);
    expect(editor!.markdown()).toBe('One\n\n![a](.bava/attachments/a.png)\n\nTwo\n');
  });

  it('reach the attachments from a page in a folder', () => {
    open('Text\n', 'Notes/Page.md');
    caretAfter('Text');
    editor!.insertMedia(['a.png']);
    expect(editor!.markdown()).toBe('Text\n\n![a](../.bava/attachments/a.png)\n');
  });

  it('go where they were dropped: between blocks, never inside a line', () => {
    open('First line\n\nSecond line\n');
    const view = editor!.view!;
    // Inside "First line": the block goes beside that line.
    editor!.insertMedia(['a.png'], 3);
    expect(editor!.markdown()).toBe('![a](.bava/attachments/a.png)\n\nFirst line\n\nSecond line\n');
    expect(view.state.doc.child(0).type.name).toBe('image');
  });
});

describe('pasting and dropping files onto the page', () => {
  it('asks the app for a pasted image when the clipboard holds no text', () => {
    const { view, onPasteImage } = open('Text\n');
    const event = { clipboardData: { types: ['Files'], getData: () => '' }, preventDefault: vi.fn() } as unknown as ClipboardEvent;
    const handled = view.someProp('handlePaste', (f) => f(view, event, Slice.empty));
    expect(handled).toBe(true);
    expect(onPasteImage).toHaveBeenCalled();
  });

  it('pastes text as text when there is some', () => {
    const { view, onPasteImage } = open('Text\n');
    const event = { clipboardData: { types: ['text/plain'], getData: (type: string) => (type === 'text/plain' ? 'words' : '') } } as unknown as ClipboardEvent;
    view.someProp('handlePaste', (f) => f(view, event, Slice.empty));
    expect(onPasteImage).not.toHaveBeenCalled();
  });

  it('leaves dropped files to the app, which adds them where they land', () => {
    const { view } = open('Text\n');
    const event = { dataTransfer: { types: ['Files'] }, preventDefault: vi.fn() } as unknown as DragEvent;
    expect(view.someProp('handleDrop', (f) => f(view, event, Slice.empty, false))).toBe(true);
    expect(editor!.markdown()).toBe('Text\n');
  });
});
