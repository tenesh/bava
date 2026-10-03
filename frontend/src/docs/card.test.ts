// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { NodeSelection } from 'prosemirror-state';
import { DocEditor } from './editor';
import { openEditor, settle } from './test-editor';
import { fileLook } from './card';

describe('what a file card says of its file', () => {
  it('is an icon and a type by the file name', () => {
    expect(fileLook('Q3 report.pdf')).toEqual({ icon: 'text', type: 'PDF' });
    expect(fileLook('budget.XLSX')).toEqual({ icon: 'sheet', type: 'XLSX' });
    expect(fileLook('site.zip')).toEqual({ icon: 'archive', type: 'ZIP' });
    expect(fileLook('main.go')).toEqual({ icon: 'code', type: 'GO' });
    expect(fileLook('deck.key')).toEqual({ icon: 'slides', type: 'KEY' });
    expect(fileLook('README')).toEqual({ icon: 'file', type: '' });
  });
});

let editor: DocEditor | null = null;

/** Opens a page whose files the app answers for: `files` by their path in the Space. */
function open(markdown: string, files: Record<string, { size: number; modified: string }> = {}) {
  const options = {
    onChange: vi.fn(),
    onOpenFile: vi.fn(),
    fileDetails: vi.fn(async (_root: string, path: string) => {
      const file = files[path];
      return file ? { exists: true, size: file.size, modified: file.modified, error: '' } : { exists: false, size: 0, modified: '', error: '' };
    }),
  };
  const opened = openEditor(markdown, options);
  editor = opened.editor;
  const { host } = opened;
  editor.setMediaPlace({ root: '/Space', here: 'Page.md' });
  return { ...options, host, view: editor.view! };
}

describe('a file card', () => {
  const report = { '.bava/attachments/Q3 report.pdf': { size: 248_000, modified: '2026-09-21T09:00:00Z' } };

  it('asks for a new name over its name, aligned to it and as tall as its line', () => {
    const { host } = open('<!-- bava: card -->\n[Q3 report.pdf](.bava/attachments/Q3%20report.pdf)\n', report);
    host.querySelector<HTMLElement>('.card')!.getBoundingClientRect = () => new DOMRect(80, 300, 500, 60);
    host.querySelector<HTMLElement>('.card-title')!.getBoundingClientRect = () => new DOMRect(124, 312, 200, 20);
    expect(editor!.fieldAt(0)).toStrictEqual({ left: 124, top: 312, height: 20 });
  });

  it('shows its icon, name and size, read from the file', async () => {
    const { host } = open('<!-- bava: card -->\n[Q3 report.pdf](.bava/attachments/Q3%20report.pdf)\n', report);
    await settle();
    const card = host.querySelector('.card')!;
    expect(card.getAttribute('data-kind')).toBe('file');
    expect(card.querySelector('.card-icon')!.getAttribute('data-icon')).toBe('text');
    expect(card.querySelector('.card-title')!.textContent).toBe('Q3 report.pdf');
    expect(card.querySelector('.card-meta')!.textContent).toBe('242.2 KB');
  });

  it('extended, adds its type and the day it was changed', async () => {
    const { host } = open('<!-- bava: card=extended -->\n[Q3 report.pdf](.bava/attachments/Q3%20report.pdf)\n', report);
    await settle();
    expect(host.querySelector('.card-meta')!.textContent).toBe('PDF · 242.2 KB · 21 Sep 2026');
  });

  it('opens its file when clicked', () => {
    const { host, onOpenFile } = open('<!-- bava: card -->\n[Q3 report.pdf](.bava/attachments/Q3%20report.pdf)\n', report);
    host.querySelector<HTMLElement>('.card')!.click();
    expect(onOpenFile).toHaveBeenCalledWith('.bava/attachments/Q3%20report.pdf');
  });

  it('says when its file is missing, and offers the file of its name in the attachments', async () => {
    const { host } = open('<!-- bava: card -->\n[Q3 report.pdf](old/Q3%20report.pdf)\n', report);
    await settle();
    await settle();
    const card = host.querySelector('.card')!;
    expect(card.getAttribute('data-state')).toBe('missing');
    const relink = card.querySelector('button')!;
    expect(relink.textContent).toBe('Relink to Q3 report.pdf');
    relink.click();
    expect(editor!.markdown()).toBe('<!-- bava: card -->\n[Q3 report.pdf](.bava/attachments/Q3%20report.pdf)\n');
  });

  it('changes in place when its look changes', async () => {
    const { host, view } = open('<!-- bava: card -->\n[Q3 report.pdf](.bava/attachments/Q3%20report.pdf)\n', report);
    await settle();
    const card = host.querySelector('.card');
    view.dispatch(view.state.tr.setNodeMarkup(0, null, { ...view.state.doc.firstChild!.attrs, look: 'extended' }));
    await settle();
    expect(host.querySelector('.card')).toBe(card);
    expect(card!.getAttribute('data-look')).toBe('extended');
  });
});

describe('a web card', () => {
  it('shows the saved icon, the title and the domain, and asks the web for nothing', () => {
    const { host, fileDetails } = open('<!-- bava: card icon="example.com icon.png" -->\n[Release notes](https://www.example.com/notes)\n');
    const card = host.querySelector('.card')!;
    expect(card.getAttribute('data-kind')).toBe('web');
    const icon = card.querySelector<HTMLImageElement>('.card-icon img')!;
    expect(new URL(icon.src).pathname).toBe('/bava-file/');
    expect(new URL(icon.src).searchParams.get('path')).toBe('.bava/attachments/example.com icon.png');
    expect(card.querySelector('.card-meta')!.textContent).toBe('example.com');
    expect(fileDetails).not.toHaveBeenCalled();
    for (const img of card.querySelectorAll('img')) expect(new URL(img.src).origin).toBe(window.location.origin);
  });

  it('extended, adds the description and the saved picture', () => {
    const { host } = open(
      '<!-- bava: card=extended description="How we ship." image="example.com picture.png" -->\n[Release notes](https://www.example.com/notes)\n',
    );
    const card = host.querySelector('.card')!;
    expect(card.querySelector('.card-description')!.textContent).toBe('How we ship.');
    expect(new URL(card.querySelector<HTMLImageElement>('.card-picture')!.src).searchParams.get('path')).toBe('.bava/attachments/example.com picture.png');
  });

  it("shows the web's own icon when its saved one will not load", () => {
    const { host } = open('<!-- bava: card icon="example.com icon.ico" -->\n[Notes](https://example.com)\n');
    host.querySelector('.card-icon img')!.dispatchEvent(new Event('error'));
    expect(host.querySelector('.card-icon')!.getAttribute('data-icon')).toBe('web');
    expect(host.querySelector('.card-icon img')).toBeNull();
  });

  it('opens with Enter when selected from the keyboard', () => {
    const { view, onOpenFile } = open('<!-- bava: card -->\n[Notes](https://example.com/notes)\n');
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    view.someProp('handleKeyDown', (f) => f(view, new KeyboardEvent('keydown', { key: 'Enter' })));
    expect(onOpenFile).toHaveBeenCalledWith('https://example.com/notes');
  });

  it('shows no picture that is not a plain name in the attachments', () => {
    const { host } = open('<!-- bava: card=extended image="../secret.png" icon="a/b.png" -->\n[Notes](https://example.com)\n');
    expect(host.querySelectorAll('.card img')).toHaveLength(0);
  });

  it('opens its page when clicked', () => {
    const { host, onOpenFile } = open('<!-- bava: card -->\n[Notes](https://example.com/notes)\n');
    host.querySelector<HTMLElement>('.card')!.click();
    expect(onOpenFile).toHaveBeenCalledWith('https://example.com/notes');
  });
});
