// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { DocEditor } from './editor';

let editor: DocEditor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function open(markdown: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const onCopy = vi.fn();
  const onCodeLanguage = vi.fn();
  editor = new DocEditor();
  editor.mount(host, { onChange: vi.fn(), onCopy, onCodeLanguage });
  editor.setPage(markdown);
  return { editor, onCopy, onCodeLanguage, view: editor.view!, host };
}

function type(text: string) {
  const view = editor!.view!;
  for (const char of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
  }
}

function key(name: string, mods: { shift?: boolean; mod?: boolean } = {}) {
  const view = editor!.view!;
  const mac = /Mac|iP(hone|[oa]d)/.test(navigator.platform);
  const event = new KeyboardEvent('keydown', { key: name, shiftKey: mods.shift, metaKey: mac && mods.mod, ctrlKey: !mac && mods.mod, bubbles: true });
  return view.someProp('handleKeyDown', (f) => f(view, event));
}

/** Puts the caret at `offset` characters into the first code block's text. */
function caretInCode(offset: number) {
  const view = editor!.view!;
  let at = -1;
  view.state.doc.descendants((node, pos) => {
    if (at < 0 && node.type.name === 'code_block') at = pos + 1;
  });
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at + offset)));
}

describe('a code block in the page', () => {
  it('colours its code by its language, once the language has loaded', async () => {
    const { host } = open('```js\nconst x = 1;\n```\n');
    await vi.waitFor(() => expect(host.querySelector('.syntax-keyword')?.textContent).toBe('const'));
  });

  it('knows a language by its short name, and leaves one it does not know plain', async () => {
    const { host } = open('```ts\nlet y: number;\n```\n\n```klingon\nqapla\n```\n');
    await vi.waitFor(() => expect(host.querySelector('.syntax-keyword')?.textContent).toBe('let'));
    expect(host.querySelectorAll('pre')[1].querySelector('[class^="syntax-"]')).toBeNull();
  });

  it('takes Enter as a new line and Tab as two spaces', () => {
    open('```\nab\n```\n');
    caretInCode(1);
    key('Enter');
    key('Tab');
    expect(editor!.markdown()).toBe('```\na\n  b\n```\n');
  });

  it('indents and outdents every line a selection touches, keeping the text', () => {
    open('```\none\ntwo\nthree\n```\n');
    const view = editor!.view!;
    // From inside "one" to inside "two".
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2, 6)));
    key('Tab');
    expect(editor!.markdown()).toBe('```\n  one\n  two\nthree\n```\n');
    key('Tab', { shift: true });
    expect(editor!.markdown()).toBe('```\none\ntwo\nthree\n```\n');
  });

  it('is left with ⌘Enter, onto a new line after it', () => {
    open('```\ncode\n```\n');
    caretInCode(4);
    key('Enter', { mod: true });
    type('After');
    expect(editor!.markdown()).toBe('```\ncode\n```\n\nAfter\n');
  });

  it('turns back into text with Backspace when empty', () => {
    open('```\n```\n');
    caretInCode(0);
    key('Backspace');
    expect(editor!.view!.state.doc.firstChild!.type.name).toBe('paragraph');
  });

  it('is made by typing ``` and a language, then Enter or a space', () => {
    open('\n');
    type('```go');
    key('Enter');
    type('x := 1');
    expect(editor!.markdown()).toBe('```go\nx := 1\n```\n');
    open('\n');
    type('```py ');
    type('pass');
    expect(editor!.markdown()).toBe('```py\npass\n```\n');
  });

  it('copies its code with the Copy button', () => {
    const { host, onCopy } = open('```\nline one\nline two\n```\n');
    host.querySelector<HTMLButtonElement>('.code-copy')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(onCopy).toHaveBeenCalledWith('line one\nline two');
  });

  it('switches wrapping with the Wrap button, saved in its mark', () => {
    const { host } = open('```\nx\n```\n');
    host.querySelector<HTMLButtonElement>('.code-wrap')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(editor!.markdown()).toBe('<!-- bava: wrap -->\n```\nx\n```\n');
    expect(host.querySelector('.code-block')!.hasAttribute('data-wrap')).toBe(true);
  });

  it('takes a caption typed under it, and drops an emptied one', () => {
    const { host } = open('```\nx\n```\n');
    const caption = host.querySelector<HTMLInputElement>('.code-caption')!;
    caption.value = 'Start the server';
    caption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor!.markdown()).toBe('<!-- bava: caption="Start the server" -->\n```\nx\n```\n');
    caption.value = '';
    caption.dispatchEvent(new Event('change', { bubbles: true }));
    expect(editor!.markdown()).toBe('```\nx\n```\n');
  });

  it('asks for a language from its language button, and takes the one chosen', () => {
    const { host, onCodeLanguage } = open('```\nx\n```\n');
    host.querySelector<HTMLButtonElement>('.code-language')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(onCodeLanguage).toHaveBeenCalledWith(0, expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    editor!.setCodeLanguage(0, 'go');
    expect(editor!.markdown()).toBe('```go\nx\n```\n');
    expect(host.querySelector('.code-language')!.textContent).toBe('Go');
  });
});
