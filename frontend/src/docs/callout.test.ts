// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DocEditor } from './editor';
import { openEditor } from './test-editor';
import { calloutLook, callouts } from './callout';
import { runItem } from './slash';
import { SLASH_ITEMS } from './slash';

let editor: DocEditor | null = null;

function open(markdown: string) {
  const opened = openEditor(markdown, { caretAtEnd: true });
  editor = opened.editor;
  const { host, view } = opened;
  return { view, host };
}

function type(text: string) {
  const view = editor!.view!;
  for (const char of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
  }
}

const item = (id: string) => SLASH_ITEMS.find((i) => i.id === id)!;

describe('callouts', () => {
  it('is inserted from the / menu as an Info callout', () => {
    open('');
    runItem(editor!.view!, item('callout'));
    type('Careful.');
    expect(editor!.markdown()).toBe('> [!info]\n> Careful.\n');
  });

  it('is made by typing a marker at the start of a quote', () => {
    open('');
    type('> ');
    type('[!warning] ');
    type('Back up.');
    expect(editor!.markdown()).toBe('> [!warning]\n> Back up.\n');
  });

  it('changes kind, turning a custom one back into a named one', () => {
    const { view } = open('<!-- bava: color=purple icon=🚀 -->\n> [!note]\n> Go.\n');
    callouts.setKind(0, 'error')(view.state, view.dispatch);
    expect(editor!.markdown()).toBe('> [!error]\n> Go.\n');
  });

  it('takes a colour and an icon as a custom callout', () => {
    const { view } = open('> [!info]\n> Go.\n');
    callouts.setColor(0, 'green')(view.state, view.dispatch);
    callouts.setIcon(0, '🌱')(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('<!-- bava: color=green icon=🌱 -->\n> [!note]\n> Go.\n');
  });

  it('shows its icon and title, which cannot be typed into', () => {
    const { host } = open('> [!tip] Heads up\n> Go.\n');
    const aside = host.querySelector('aside.callout')!;
    expect(aside.getAttribute('data-look')).toBe('info');
    expect(aside.querySelector('.callout-title')?.textContent).toBe('Heads up');
    expect(aside.querySelector('.callout-side')?.getAttribute('contenteditable')).toBe('false');
  });
});

describe('how a kind looks', () => {
  it('shows every kind as the nearest of the five, or as a note', () => {
    expect(['info', 'tip', 'TODO', 'abstract'].map(calloutLook)).toEqual(['info', 'info', 'info', 'info']);
    expect(['success', 'done', 'check'].map(calloutLook)).toEqual(['success', 'success', 'success']);
    expect(['warning', 'caution', 'Attention'].map(calloutLook)).toEqual(['warning', 'warning', 'warning']);
    expect(['error', 'danger', 'bug', 'failure'].map(calloutLook)).toEqual(['error', 'error', 'error', 'error']);
    expect(['note', 'quote', 'whatever'].map(calloutLook)).toEqual(['note', 'note', 'note']);
  });
});
