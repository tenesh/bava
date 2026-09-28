// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { DocEditor } from './editor';
import { loadEmoji, searchEmoji } from './emoji';
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
  const onEmoji = vi.fn();
  const onEmojiPicker = vi.fn();
  editor = new DocEditor();
  editor.mount(host, { onChange: vi.fn(), onEmoji, onEmojiPicker });
  editor.setPage(markdown);
  const view = editor.view!;
  view.dispatch(view.state.tr.setSelection(atTextEnd(view.state.doc)));
  return { onEmoji, onEmojiPicker, view };
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

describe('finding emoji by name', () => {
  it('puts names that start with what was typed first', async () => {
    const all = await loadEmoji();
    expect(searchEmoji(all, 'rocke')[0].emoji).toBe('🚀');
    expect(searchEmoji(all, 'rock')[0].emoji).toBe('🪨');
    expect(searchEmoji(all, 'smil').length).toBeGreaterThan(3);
    expect(searchEmoji(all, 'SMIL').map((e) => e.emoji)).toEqual(searchEmoji(all, 'smil').map((e) => e.emoji));
    expect(searchEmoji(all, 'zzzzq')).toEqual([]);
  });

  it('knows each emoji\'s group', async () => {
    const all = await loadEmoji();
    expect(all.find((e) => e.emoji === '🚀')?.group).toBe('travel_places');
  });
});

describe('emoji typed in the page', () => {
  it('offers matches after : and two letters, and Enter puts the emoji in', async () => {
    const { onEmoji } = open('Launch');
    type(' :rocke');
    await vi.waitFor(() => expect(onEmoji).toHaveBeenLastCalledWith(expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ emoji: '🚀' })]) })));
    expect(key('Enter')).toBe(true);
    expect(editor!.markdown()).toBe('Launch 🚀\n');
    expect(onEmoji).toHaveBeenLastCalledWith(null);
  });

  it('offers nothing for : inside a word or in code, or with one letter', async () => {
    await loadEmoji();
    const first = open('http');
    type('://ro');
    expect(first.onEmoji).not.toHaveBeenCalledWith(expect.objectContaining({ items: expect.anything() }));
    const second = open('```\nx\n```\n');
    second.view.dispatch(second.view.state.tr.setSelection(TextSelection.create(second.view.state.doc, 2)));
    type(' :roc');
    expect(second.onEmoji).not.toHaveBeenCalledWith(expect.objectContaining({ items: expect.anything() }));
    const third = open('');
    type(':r');
    expect(third.onEmoji).not.toHaveBeenCalledWith(expect.objectContaining({ items: expect.anything() }));
  });

  it('closes on Escape, leaving what was typed', async () => {
    const { onEmoji } = open('');
    type(':roc');
    await vi.waitFor(() => expect(onEmoji).toHaveBeenCalledWith(expect.objectContaining({ items: expect.anything() })));
    expect(key('Escape')).toBe(true);
    expect(onEmoji).toHaveBeenLastCalledWith(null);
    expect(editor!.markdown()).toBe(':roc\n');
  });

  it('opens the picker from the / menu, and puts in the emoji picked', () => {
    const { onEmojiPicker, view } = open('Hi');
    runItem(view, SLASH_ITEMS.find((i) => i.id === 'emoji')!);
    expect(onEmojiPicker).toHaveBeenCalled();
    editor!.insertText('👋');
    expect(editor!.markdown()).toBe('Hi👋\n');
  });
});
