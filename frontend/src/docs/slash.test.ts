// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocEditor } from './editor';
import { filterItems, SLASH_ITEMS, slashKey } from './slash';
import { atTextEnd } from './test-caret';

describe('the / menu\'s items', () => {
  it('offers each kind of block once, in three groups', () => {
    expect(SLASH_ITEMS.map((item) => `${item.group}:${item.id}`)).toEqual([
      'basic:paragraph',
      'basic:heading1',
      'basic:heading2',
      'basic:heading3',
      'basic:heading4',
      'basic:heading5',
      'basic:heading6',
      'basic:bullet',
      'basic:numbered',
      'basic:todo',
      'basic:toggle',
      'basic:quote',
      'basic:divider',
      'advanced:callout',
      'advanced:table',
      'advanced:code',
      'advanced:equation',
      'advanced:contents',
      'inline:inlineEquation',
      'inline:footnote',
      'inline:emoji',
    ]);
  });

  it('filters by name and by other words for it, ignoring case', () => {
    expect(filterItems('head').map((i) => i.id)).toEqual(['heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6']);
    expect(filterItems('h2').map((i) => i.id)).toEqual(['heading2']);
    expect(filterItems('CHECK').map((i) => i.id)).toEqual(['todo']);
    expect(filterItems('line').map((i) => i.id)).toContain('divider');
    expect(filterItems('warning').map((i) => i.id)).toEqual(['callout']);
    expect(filterItems('zzz')).toEqual([]);
    expect(filterItems('')).toHaveLength(SLASH_ITEMS.length);
  });
});

let editor: DocEditor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function open(markdown: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const onSlash = vi.fn();
  editor = new DocEditor();
  editor.mount(host, { onChange: vi.fn(), onSlash });
  editor.setPage(markdown);
  const view = editor.view!;
  view.dispatch(view.state.tr.setSelection(atTextEnd(view.state.doc)));
  return { onSlash, view };
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
  return view.someProp('handleKeyDown', (f) => f(view, new KeyboardEvent('keydown', { key: name })));
}

describe('the / menu in the page', () => {
  it('opens on / at the start of a line, and follows what is typed after it', () => {
    const { onSlash } = open('');
    type('/');
    expect(onSlash).toHaveBeenLastCalledWith(expect.objectContaining({ query: '' }));
    type('hea');
    expect(onSlash).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'hea' }));
  });

  it('opens after a space too, but not inside a word', () => {
    const { onSlash } = open('Some text');
    type(' /');
    expect(onSlash).toHaveBeenLastCalledWith(expect.objectContaining({ query: '' }));
    const second = open('a');
    type('/');
    expect(second.onSlash).not.toHaveBeenCalledWith(expect.objectContaining({ query: '' }));
  });

  it('closes on Escape, and the keys go to the menu while it is open', () => {
    const { onSlash } = open('');
    type('/');
    expect(key('ArrowDown')).toBe(true);
    expect(onSlash).toHaveBeenLastCalledWith(expect.objectContaining({ active: 1 }));
    expect(key('Escape')).toBe(true);
    expect(onSlash).toHaveBeenLastCalledWith(null);
    // Closed: its keys go back to the page.
    expect(slashKey.getState(editor!.view!.state)?.open).toBeNull();
  });

  it('runs the chosen item on Enter, removing what was typed for it', () => {
    open('');
    type('/head');
    key('ArrowDown');
    key('Enter');
    type('Title');
    expect(editor!.markdown()).toBe('## Title\n');
  });

  it('runs an item picked with the pointer', () => {
    open('');
    type('/quo');
    editor!.chooseSlash('quote');
    type('Said');
    expect(editor!.markdown()).toBe('> Said\n');
  });

  it('opens from the block handle\'s +, on a new line after the block', () => {
    const { onSlash } = open('First\n\nSecond');
    editor!.addBlockAfter(0);
    expect(onSlash).toHaveBeenLastCalledWith(expect.objectContaining({ query: '' }));
    key('Enter');
    type('Between');
    expect(editor!.markdown()).toBe('First\n\nBetween\n\nSecond\n');
  });

  it('opens from the + on an empty line itself, adding no line', () => {
    // The empty line the page always ends with.
    const { onSlash } = open('First\n');
    const view = editor!.view!;
    const empty = view.state.doc.content.size - 2;
    editor!.addBlockAfter(empty);
    expect(onSlash).toHaveBeenLastCalledWith(expect.objectContaining({ query: '' }));
    // The `/` went into that line itself; a new empty line keeps the page's end.
    expect(view.state.doc.child(1).textContent).toBe('/');
    expect(view.state.doc.childCount).toBe(3);
  });

  it('turns the line into a code block', () => {
    open('');
    type('/code');
    key('Enter');
    type('x := 1');
    expect(editor!.markdown()).toBe('```\nx := 1\n```\n');
  });

  it('inserts a divider, with a line after it to go on typing', () => {
    open('');
    type('/div');
    key('Enter');
    type('After');
    expect(editor!.markdown()).toBe('---\n\nAfter\n');
  });
});
