// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { DocEditor } from './editor';
import { atTextEnd } from './test-caret';

for (const name of ['getClientRects', 'getBoundingClientRect'] as const) {
  if (!(name in Range.prototype)) {
    Object.defineProperty(Range.prototype, name, { value: name === 'getClientRects' ? () => [] : () => new DOMRect(), configurable: true });
  }
}

let editor: DocEditor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

type Details = { title: string; description: string; icon: string; image: string } | null;

function open(markdown: string, details: Details = null) {
  const host = document.createElement('div');
  document.body.append(host);
  let answer: (value: Details) => void = () => {};
  const fetchCard = vi.fn(() => new Promise<Details>((resolve) => (answer = resolve)));
  const options = { onChange: vi.fn(), fetchCard, fileDetails: async () => ({ exists: true, size: 1, modified: '2026-09-21T00:00:00Z', error: '' }) };
  editor = new DocEditor();
  editor.mount(host, options);
  editor.setPage(markdown);
  editor.setSpacePages('Page.md', []);
  const view = editor.view!;
  view.dispatch(view.state.tr.setSelection(atTextEnd(view.state.doc)));
  return { ...options, view, arrive: () => answer(details) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Moves the caret onto the empty line the page ends with. */
function toEndLine() {
  const view = editor!.view!;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, view.state.doc.content.size - 1)));
}

describe('a web address pasted alone on an empty line', () => {
  it('is an online video, for a video site', () => {
    open('Text\n');
    toEndLine();
    editor!.paste('https://youtu.be/abc123');
    expect(editor!.markdown()).toBe('Text\n\n![](https://youtu.be/abc123)\n');
  });

  it('is an image, for an image file', () => {
    open('Text\n');
    toEndLine();
    editor!.paste('https://example.com/chart.png');
    expect(editor!.markdown()).toBe('Text\n\n![](https://example.com/chart.png)\n');
  });

  it('is a link, which becomes a card when the page’s details arrive', async () => {
    const { fetchCard, arrive } = open('Text\n', { title: 'Release notes', description: 'How we ship.', icon: 'example.com icon.png', image: '' });
    toEndLine();
    editor!.paste('https://example.com/notes');
    expect(editor!.markdown()).toBe('Text\n\n<https://example.com/notes>\n');
    expect(fetchCard).toHaveBeenCalledWith('https://example.com/notes');
    arrive();
    await settle();
    expect(editor!.markdown()).toBe('Text\n\n<!-- bava: card description="How we ship." icon="example.com icon.png" -->\n[Release notes](https://example.com/notes)\n');
    // Undone, it is the link it was.
    editor!.undo();
    expect(editor!.markdown()).toBe('Text\n\n<https://example.com/notes>\n');
  });

  it('stays a link when the details do not arrive', async () => {
    const { arrive } = open('Text\n', null);
    toEndLine();
    editor!.paste('https://example.com/notes');
    arrive();
    await settle();
    expect(editor!.markdown()).toBe('Text\n\n<https://example.com/notes>\n');
  });

  it('stays a link when it was changed before the details arrived', async () => {
    const { arrive, view } = open('Text\n', { title: 'T', description: '', icon: '', image: '' });
    toEndLine();
    editor!.paste('https://example.com/notes');
    view.dispatch(view.state.tr.insertText('!', view.state.selection.from));
    arrive();
    await settle();
    expect(editor!.markdown()).not.toContain('bava: card');
  });

  it('asks for nothing on a locked page', () => {
    const { fetchCard } = open('---\nbava:\n  locked: true\n---\nText\n');
    toEndLine();
    editor!.insertAddress('https://example.com/notes');
    expect(fetchCard).not.toHaveBeenCalled();
  });

  it('is plain text inside a line of text, as before', () => {
    const { fetchCard } = open('Text\n');
    editor!.paste('https://example.com/notes');
    expect(editor!.markdown()).toBe('Texthttps://example.com/notes\n');
    expect(fetchCard).not.toHaveBeenCalled();
  });
});

describe('a card and a link, one into the other', () => {
  it('turns a card into a plain link, and back', () => {
    const { view } = open('<!-- bava: card=extended -->\n[Q3 report.pdf](Q3%20report.pdf)\n');
    editor!.cardToLink(0);
    expect(editor!.markdown()).toBe('[Q3 report.pdf](Q3%20report.pdf)\n');
    expect(editor!.loneLinkAt(0)).toBe(true);
    editor!.linkToCard(0);
    expect(editor!.markdown()).toBe('<!-- bava: card -->\n[Q3 report.pdf](Q3%20report.pdf)\n');
    expect(view.state.doc.firstChild!.type.name).toBe('card');
  });

  it("keeps the keys it does not know, and a line's colours, across both", () => {
    open('<!-- bava: color=red later=1 -->\n[a](a.pdf)\n');
    editor!.linkToCard(0);
    expect(editor!.markdown()).toBe('<!-- bava: card color=red later=1 -->\n[a](a.pdf)\n');
    editor!.cardToLink(0);
    expect(editor!.markdown()).toBe('<!-- bava: color=red later=1 -->\n[a](a.pdf)\n');
  });

  it('finds no lone link in a line of text', () => {
    open('See [a](a.pdf).\n');
    expect(editor!.loneLinkAt(0)).toBe(false);
  });
});

describe('the block a menu is for', () => {
  it('is selected whole when it is a card, an image or a video, never the block after it', () => {
    const { view } = open('<!-- bava: card -->\n[a](a.pdf)\n\n![v](v.mp4)\n\n![i](i.png)\n');
    for (const pos of [0, view.state.doc.child(0).nodeSize]) {
      editor!.selectBlock(pos);
      expect(view.state.selection).toBeInstanceOf(NodeSelection);
      expect(view.state.selection.from).toBe(pos);
    }
  });
});

describe('a block followed across a wait', () => {
  it('is found again after edits above it, and lost once it changed', () => {
    const { view } = open('Before\n\n<!-- bava: card -->\n[a](a.pdf)\n');
    const at = view.state.doc.child(0).nodeSize;
    const find = editor!.follow(at);
    view.dispatch(view.state.tr.insertText('more ', 1));
    expect(find()).toBe(at + 5);
    view.dispatch(view.state.tr.setNodeMarkup(at + 5, null, { ...view.state.doc.nodeAt(at + 5)!.attrs, look: 'extended' }));
    expect(find()).toBeNull();
  });
});
