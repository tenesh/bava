// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocEditor } from './editor';
import { headingEntries } from './contents';
import { parsePage } from './markdown';
import { runItem, SLASH_ITEMS } from './slash';
import { atTextEnd } from './test-caret';

let editor: DocEditor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function open(markdown: string) {
  const host = document.createElement('div');
  document.body.append(host);
  editor = new DocEditor();
  editor.mount(host, { onChange: vi.fn() });
  editor.setPage(markdown);
  return { host, view: editor.view! };
}

const listed = (host: HTMLElement) =>
  [...host.querySelectorAll('.contents a')].map((a) => `${a.getAttribute('data-depth')}:${a.textContent}:${a.getAttribute('href')}`);

describe("the page's headings, for its contents", () => {
  it('nests each under the nearest larger one above, with GitHub anchors', () => {
    const doc = parsePage('# One\n\n### Three\n\n## Two\n\n## Two\n\n# Top\n').doc;
    expect(headingEntries(doc).map((e) => [e.depth, e.text, e.slug])).toEqual([
      [0, 'One', 'one'],
      [1, 'Three', 'three'],
      [1, 'Two', 'two'],
      [1, 'Two', 'two-1'],
      [0, 'Top', 'top'],
    ]);
  });
});

describe('the contents block', () => {
  it('lists the headings as links', () => {
    const { host } = open('<!-- bava: contents -->\n\n<!-- bava: /contents -->\n\n# Goals\n\n## Beta\n');
    expect(listed(host)).toEqual(['0:Goals:#goals', '1:Beta:#beta']);
  });

  it('follows a heading as it is edited', () => {
    const { host, view } = open('<!-- bava: contents -->\n\n<!-- bava: /contents -->\n\n# Goals\n');
    view.dispatch(view.state.tr.insertText(' now', view.state.doc.child(0).nodeSize + 1 + 5));
    expect(listed(host)).toEqual(['0:Goals now:#goals-now']);
  });

  it('goes to a heading when its entry is pressed', () => {
    const { host, view } = open('<!-- bava: contents -->\n\n<!-- bava: /contents -->\n\nText.\n\n## Far\n');
    host.querySelector('.contents a')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(view.state.selection.$from.parent.textContent).toBe('Far');
  });

  it('is inserted from the / menu', () => {
    const { view } = open('# Title\n\n\n');
    view.dispatch(view.state.tr.setSelection(atTextEnd(view.state.doc)));
    runItem(view, SLASH_ITEMS.find((i) => i.id === 'contents')!);
    expect(editor!.markdown()).toBe('# Title\n\n<!-- bava: contents -->\n\n- [Title](#title)\n\n<!-- bava: /contents -->\n');
  });
});
