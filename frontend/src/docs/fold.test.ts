// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { DocEditor } from './editor';
import { openEditor } from './test-editor';
import { runItem, SLASH_ITEMS } from './slash';

let editor: DocEditor | null = null;

function open(markdown: string, key = 'page.md') {
  const onChange = vi.fn();
  const opened = openEditor(markdown, { onChange, foldMemory: key });
  editor = opened.editor;
  const { host } = opened;
  return { host, onChange, view: editor.view! };
}

function type(text: string) {
  const view = editor!.view!;
  for (const char of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
  }
}

function key(name: string) {
  const view = editor!.view!;
  return view.someProp('handleKeyDown', (f) => f(view, new KeyboardEvent('keydown', { key: name, bubbles: true })));
}

const press = (el: Element) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
const TOGGLE = '<details>\n<summary>Details</summary>\n\nThe secret.\n\n</details>\n';

describe('folding', () => {
  it('starts a toggle folded, or open when the file says so', () => {
    const { host } = open(TOGGLE + '\n<details open>\n<summary>Open</summary>\n\nShown.\n\n</details>\n');
    const toggles = host.querySelectorAll('.toggle');
    expect(toggles[0].hasAttribute('data-folded')).toBe(true);
    expect(toggles[1].hasAttribute('data-folded')).toBe(false);
  });

  it('says on its arrow whether it is folded, from the start', () => {
    const { host } = open(TOGGLE + '\n<details open>\n<summary>Open</summary>\n\nShown.\n\n</details>\n');
    const arrows = [...host.querySelectorAll('.toggle-arrow')].map((a) => a.getAttribute('aria-expanded'));
    expect(arrows).toEqual(['false', 'true']);
  });

  it('folds and unfolds from its arrow without changing the page', () => {
    const { host, onChange } = open(TOGGLE);
    press(host.querySelector('.toggle-arrow')!);
    expect(host.querySelector('.toggle')!.hasAttribute('data-folded')).toBe(false);
    press(host.querySelector('.toggle-arrow')!);
    expect(host.querySelector('.toggle')!.hasAttribute('data-folded')).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(editor!.markdown()).toBe(TOGGLE);
  });

  it('never folds a heading, even one carrying the old toggle mark', () => {
    const { host } = open('<!-- bava: toggle -->\n## Plan\n\nShown.\n\n## After\n');
    expect(host.querySelector('.toggle-arrow')).toBeNull();
    expect(host.querySelector('.folded-away')).toBeNull();
    expect(editor!.markdown()).toBe('<!-- bava: toggle -->\n## Plan\n\nShown.\n\n## After\n');
  });

  it('remembers what was unfolded on this computer, per page', () => {
    const first = open(TOGGLE, 'a.md');
    press(first.host.querySelector('.toggle-arrow')!);
    editor!.destroy();
    expect(open(TOGGLE, 'a.md').host.querySelector('.toggle')!.hasAttribute('data-folded')).toBe(false);
    editor!.destroy();
    expect(open(TOGGLE, 'b.md').host.querySelector('.toggle')!.hasAttribute('data-folded')).toBe(true);
  });

  it('carries on when this computer will not remember', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const { host } = open(TOGGLE);
    expect(() => press(host.querySelector('.toggle-arrow')!)).not.toThrow();
    expect(host.querySelector('.toggle')!.hasAttribute('data-folded')).toBe(false);
  });

  it('opens a fold that find lands in', () => {
    const { host } = open(TOGGLE);
    editor!.find('secret');
    editor!.findNext();
    expect(host.querySelector('.toggle')!.hasAttribute('data-folded')).toBe(false);
  });

});

describe('making toggles', () => {
  it('makes a toggle list from the / menu, open, and Enter moves from its summary into it', () => {
    const { host } = open('');
    runItem(editor!.view!, SLASH_ITEMS.find((i) => i.id === 'toggle')!);
    type('What ships');
    key('Enter');
    type('The editor.');
    expect(editor!.markdown()).toBe('<details>\n<summary>What ships</summary>\n\nThe editor.\n\n</details>\n');
    expect(host.querySelector('.toggle')!.hasAttribute('data-folded')).toBe(false);
  });

  it('turns an empty toggle back into text with Backspace in its summary', () => {
    const { view } = open('');
    runItem(view, SLASH_ITEMS.find((i) => i.id === 'toggle')!);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
    key('Backspace');
    expect(editor!.view!.state.doc.firstChild!.type.name).toBe('paragraph');
  });
});
