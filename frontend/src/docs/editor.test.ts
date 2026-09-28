// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { DocEditor } from './editor';
import { commands, turnIntoChoices } from './commands';
import { atTextEnd } from './test-caret';

let editor: DocEditor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function open(markdown: string, onChange = vi.fn()) {
  const host = document.createElement('div');
  document.body.append(host);
  editor = new DocEditor();
  editor.mount(host, { onChange });
  editor.setPage(markdown);
  return { editor, onChange, view: editor.view! };
}

/** Types as a keyboard would: each character through the editor's input handling. */
function type(text: string) {
  const view = editor!.view!;
  for (const char of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
  }
}

/** `mod` is ⌘ on a Mac and Ctrl elsewhere, as ProseMirror reads it. */
function key(name: string, mods: { shift?: boolean; mod?: boolean; alt?: boolean } = {}) {
  const view = editor!.view!;
  const mac = /Mac|iP(hone|[oa]d)/.test(navigator.platform);
  const event = new KeyboardEvent('keydown', {
    key: name,
    shiftKey: mods.shift,
    altKey: mods.alt,
    metaKey: mac && mods.mod,
    ctrlKey: !mac && mods.mod,
    bubbles: true,
  });
  view.someProp('handleKeyDown', (f) => f(view, event));
}

/** Puts the caret at the end of the document. */
function toEnd() {
  const view = editor!.view!;
  view.dispatch(view.state.tr.setSelection(atTextEnd(view.state.doc)));
}

describe('opening and saving a page', () => {
  it('gives an untouched page back exactly as it was read', () => {
    const { editor } = open('# Title\n\nSome __text__ &amp; more\nwrapped.\n');
    expect(editor.markdown()).toBe('# Title\n\nSome __text__ &amp; more\nwrapped.\n');
  });

  it('writes an edited page in tidy Markdown', () => {
    const { editor } = open('# Title\n\nSome __text__.\n');
    toEnd();
    type('!');
    expect(editor.markdown()).toBe('# Title\n\nSome **text**.!\n');
  });

  it('gives a changed setting back in tidy Markdown, and an edit undone back as read', () => {
    const { editor } = open('Some __text__.\n');
    editor.setSettings({ width: 'full' });
    expect(editor.markdown()).toBe('---\nbava:\n  width: full\n---\nSome **text**.\n');
    const second = open('Some __text__.\n').editor;
    toEnd();
    type('!');
    second.undo();
    expect(second.markdown()).toBe('Some __text__.\n');
  });

  // An editor with no page (a pane mounted again after a failure) has nothing
  // to save; saving must fall back to the file, never write it empty.
  it('has no Markdown before a page is shown', () => {
    const host = document.createElement('div');
    document.body.append(host);
    editor = new DocEditor();
    editor.mount(host, { onChange: vi.fn() });
    expect(editor.markdown()).toBeNull();
  });

  it('keeps the front matter it was given', () => {
    const { editor } = open('---\ntitle: T\n---\nText\n');
    expect(editor.markdown()).toBe('---\ntitle: T\n---\nText\n');
  });

  it('reports an edit, and only an edit', () => {
    const { onChange } = open('Text\n');
    expect(onChange).not.toHaveBeenCalled();
    toEnd();
    type('!');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(editor!.markdown()).toBe('Text!\n');
  });
});

describe('typing shortcuts', () => {
  const cases: [string, string][] = [
    ['# ', '# X\n'],
    ['### ', '### X\n'],
    ['###### ', '###### X\n'],
    ['- ', '- X\n'],
    ['* ', '- X\n'],
    ['1. ', '1. X\n'],
    ['a. ', '<!-- bava: list=a -->\n1. X\n'],
    ['i. ', '<!-- bava: list=i -->\n1. X\n'],
    ['[] ', '- [ ] X\n'],
    ['> ', '> X\n'],
  ];

  it.each(cases)('%j at the start of a line makes %j', (shortcut, written) => {
    open('');
    type(shortcut);
    type('X');
    expect(editor!.markdown()).toBe(written);
  });

  it('--- makes a divider', () => {
    open('');
    type('---');
    expect(editor!.markdown()).toBe('---\n');
  });

  it('does nothing in the middle of a line', () => {
    open('Word\n');
    toEnd();
    type(' # ');
    expect(editor!.markdown()).toBe('Word #\n');
  });
});

describe('commands', () => {
  function selectAll() {
    const view = editor!.view!;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, view.state.doc.firstChild!.nodeSize - 1)));
  }

  it.each([
    ['bold', '**Text**\n'],
    ['italic', '*Text*\n'],
    ['underline', '<u>Text</u>\n'],
    ['strike', '~~Text~~\n'],
    ['code', '`Text`\n'],
  ] as const)('%s wraps the selection', (name, written) => {
    open('Text\n');
    selectAll();
    commands[name](editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe(written);
  });

  it('colours text and highlights it', () => {
    open('Text\n');
    selectAll();
    commands.textColor('blue')(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('<span data-color="blue">Text</span>\n');
    commands.textColor(null)(editor!.view!.state, editor!.view!.dispatch);
    commands.highlight('yellow')(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('<span data-highlight="yellow">Text</span>\n');
  });

  it('colours a whole block, text and background', () => {
    open('Text\n');
    commands.blockColor({ color: 'red', background: 'yellow' })(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('<!-- bava: color=red background=yellow -->\nText\n');
  });

  it('turns a block into another kind', () => {
    open('Text\n');
    commands.turnInto('heading', 2)(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('## Text\n');
    commands.turnInto('bullet_list')(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('- Text\n');
    commands.turnInto('paragraph')(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('Text\n');
  });

  it('duplicates and deletes the block the caret is in', () => {
    open('One\n\nTwo\n');
    commands.duplicateBlock(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('One\n\nOne\n\nTwo\n');
    commands.deleteBlock(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('One\n\nTwo\n');
  });

  it('moves a block to another place', () => {
    open('One\n\nTwo\n\nThree\n');
    // The first block, to after the last.
    commands.moveBlock(0, editor!.view!.state.doc.content.size)(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('Two\n\nThree\n\nOne\n');
  });
});

describe('lists and keys', () => {
  it('nests a list item with Tab and brings it back with Shift+Tab', () => {
    open('- One\n- Two\n');
    toEnd();
    key('Tab');
    expect(editor!.markdown()).toBe('- One\n  - Two\n');
    key('Tab', { shift: true });
    expect(editor!.markdown()).toBe('- One\n- Two\n');
  });

  it('starts a new item on Enter, and leaves the list on Enter in an empty item', () => {
    open('- One\n');
    toEnd();
    key('Enter');
    type('Two');
    expect(editor!.markdown()).toBe('- One\n- Two\n');
    key('Enter');
    key('Enter');
    type('After');
    expect(editor!.markdown()).toBe('- One\n- Two\n\nAfter\n');
  });

  it('bolds with Cmd+B', () => {
    open('Text\n');
    const view = editor!.view!;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 5)));
    key('b', { mod: true });
    expect(editor!.markdown()).toBe('**Text**\n');
  });

  it('ticks a to-do', () => {
    open('- [ ] Buy milk\n');
    commands.toggleTodo(editor!.view!.state, editor!.view!.dispatch);
    expect(editor!.markdown()).toBe('- [x] Buy milk\n');
  });
});

describe('a locked page', () => {
  it('takes no edits, and its text is still there', () => {
    open('---\nbava:\n  locked: true\n---\nText\n');
    expect(editor!.locked).toBe(true);
    expect(editor!.view!.editable).toBe(false);
    toEnd();
    type('!');
    expect(editor!.markdown()).toBe('---\nbava:\n  locked: true\n---\nText\n');
  });

  it('unlocks, and writes that it is unlocked', () => {
    open('---\nbava:\n  locked: true\n---\nText\n');
    editor!.setSettings({ locked: false });
    expect(editor!.view!.editable).toBe(true);
    expect(editor!.markdown()).toBe('Text\n');
  });
});

describe('counting', () => {
  it('counts the words of the page, not its Markdown', () => {
    open('# Title\n\nSome **bold** words.\n');
    expect(editor!.counts()).toEqual({ words: 4, characters: 22 });
  });

  it('counts the selection when there is one', () => {
    open('One two three\n');
    const view = editor!.view!;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 8)));
    expect(editor!.counts()).toEqual({ words: 2, characters: 7 });
  });
});

describe('edit commands from the menu', () => {
  it('undoes and redoes an edit', () => {
    open('Text\n');
    toEnd();
    type('!');
    editor!.undo();
    expect(editor!.markdown()).toBe('Text\n');
    editor!.redo();
    expect(editor!.markdown()).toBe('Text!\n');
  });

  it('selects all and gives the selected text', () => {
    open('One\n\nTwo\n');
    editor!.selectAll();
    expect(editor!.selectedText()).toBe('One\nTwo');
  });

  it('deletes the selection', () => {
    open('One\n');
    editor!.selectAll();
    editor!.deleteSelection();
    expect(editor!.markdown()).toBe('');
  });

  // Markdown pasted in arrives formatted, never as the marks themselves.
  it('pastes Markdown as formatted text', () => {
    open('\n');
    editor!.paste('## Heading\n\nSome **bold** text.\n\n- one\n- two\n');
    expect(editor!.markdown()).toBe('## Heading\n\nSome **bold** text.\n\n- one\n- two\n');
  });

  it('pastes text that opens with --- lines as text, never as a header', () => {
    open('\n');
    editor!.paste('---\ntitle: x\n---\nBody\n');
    expect(editor!.view!.state.doc.textContent).toContain('title: x');
  });

  it('copies a kept block in the selection as written', () => {
    open('Before\n\n| A |\n|---|\n| 1 | 2 |\n\nAfter\n');
    editor!.selectAll();
    expect(editor!.selectedText()).toContain('| A |\n|---|\n| 1 | 2 |');
  });

  it('pastes a plain word into the line the caret is in', () => {
    open('Hello\n');
    toEnd();
    editor!.paste(' world');
    expect(editor!.markdown()).toBe('Hello world\n');
  });
});

describe('menus from the keyboard', () => {
  it('asks for the block menu on ⌘/ and for the formatting bubble on Alt+F10', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const onBlockMenu = vi.fn();
    const onBubble = vi.fn();
    editor = new DocEditor();
    editor.mount(host, { onChange: vi.fn(), onBlockMenu, onBubble });
    editor.setPage('Text\n');
    key('/', { mod: true });
    expect(onBlockMenu).toHaveBeenCalledTimes(1);
    key('F10', { alt: true });
    expect(onBubble).toHaveBeenCalledTimes(1);
  });

  it('finds the page-level block the caret is in, inside a list too', () => {
    open('First\n\n- one\n- two\n');
    toEnd();
    const block = editor!.caretBlock();
    expect(block?.pos).toBe(editor!.view!.state.doc.firstChild!.nodeSize);
  });
});

describe('a to-do\'s box', () => {
  it('ticks and unticks when clicked, as an edit', () => {
    const { onChange } = open('- [ ] Buy milk\n');
    const box = document.querySelector<HTMLElement>('.todo-box')!;
    expect(box.getAttribute('aria-checked')).toBe('false');
    box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(editor!.markdown()).toBe('- [x] Buy milk\n');
    expect(document.querySelector('.todo-box')!.getAttribute('aria-checked')).toBe('true');
    expect(onChange).toHaveBeenCalled();
  });

  it('does nothing on a locked page', () => {
    open('---\nbava:\n  locked: true\n---\n- [ ] Buy milk\n');
    document.querySelector<HTMLElement>('.todo-box')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    expect(editor!.markdown()).toContain('- [ ] Buy milk');
  });
});

describe('find and replace', () => {
  it('counts matches, ignoring case, and steps through them', () => {
    open('Plan the plan.\n\nPLAN B\n');
    expect(editor!.find('plan')).toEqual({ count: 3, index: 0 });
    expect(editor!.findNext()).toEqual({ count: 3, index: 1 });
    expect(editor!.findNext()).toEqual({ count: 3, index: 2 });
    expect(editor!.findNext()).toEqual({ count: 3, index: 0 });
    expect(editor!.findPrevious()).toEqual({ count: 3, index: 2 });
  });

  it('replaces the current match, then all of them in one undo', () => {
    open('cat cat cat\n');
    editor!.find('cat');
    editor!.replace('dog');
    expect(editor!.markdown()).toBe('dog cat cat\n');
    editor!.replaceAll('cow');
    expect(editor!.markdown()).toBe('dog cow cow\n');
    editor!.undo();
    expect(editor!.markdown()).toBe('dog cat cat\n');
  });

  it('finds nothing in an empty query, and clears', () => {
    open('Text\n');
    expect(editor!.find('')).toEqual({ count: 0, index: -1 });
    expect(editor!.find('zzz')).toEqual({ count: 0, index: -1 });
  });
});

describe('the selection', () => {
  it('says which marks the selection carries', () => {
    open('**Bold** plain\n');
    const view = editor!.view!;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 5)));
    expect(editor!.activeMarks()).toEqual(expect.objectContaining({ bold: true, italic: false }));
  });
});

describe('what the caret is in, for Turn into', () => {
  const at = (markdown: string, text: string) => {
    open(markdown);
    const view = editor!.view!;
    let pos = -1;
    view.state.doc.descendants((node, p) => {
      if (pos < 0 && node.isText && node.text!.includes(text)) pos = p + 1;
    });
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
    return editor!.currentKind();
  };

  it('names each kind Turn into offers', () => {
    expect(at('Plain.\n', 'Plain')).toBe('paragraph');
    expect(at('## Two\n', 'Two')).toBe('heading:2');
    expect(at('###### Six\n', 'Six')).toBe('heading:6');
    expect(at('- Bullet\n', 'Bullet')).toBe('bullet_list');
    expect(at('1. Number\n', 'Number')).toBe('ordered_list');
    expect(at('- [ ] Task\n', 'Task')).toBe('todo');
    expect(at('> Quoted\n', 'Quoted')).toBe('blockquote');
  });

  it('names nothing for a block Turn into does not offer', () => {
    expect(at('<details>\n<summary>Folded</summary>\n\nInside\n\n</details>\n', 'Inside')).toBeNull();
    expect(at('> [!info]\n> Callout\n', 'Callout')).toBeNull();
    expect(at('| A   |\n|-----|\n| Cell |\n', 'Cell')).toBeNull();
  });
});

describe('the placeholder', () => {
  it('is not shown in an empty code block', () => {
    open('```\n```\n');
    const view = editor!.view!;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
    expect(document.querySelector('.is-empty')).toBeNull();
  });
});

describe("the handle's + beside the notes", () => {
  it('adds the line before the notes, never after them', () => {
    open('Text.[^1]\n\n[^1]: Note.\n');
    const view = editor!.view!;
    const notes = view.state.doc.content.size - view.state.doc.lastChild!.nodeSize;
    expect(() => editor!.addBlockAfter(notes)).not.toThrow();
    expect(view.state.doc.lastChild!.type.name).toBe('footnotes');
    // Before the notes, and before the empty line the page ends with.
    expect(view.state.doc.child(view.state.doc.childCount - 3).textContent).toBe('/');
  });
});

describe('what a block can turn into', () => {
  it('turns text and headings into one another, and lists into lists', () => {
    expect(turnIntoChoices('paragraph')).toEqual(['heading:1', 'heading:2', 'heading:3', 'heading:4', 'heading:5', 'heading:6']);
    expect(turnIntoChoices('heading:2')).toEqual(['paragraph', 'heading:1', 'heading:3', 'heading:4', 'heading:5', 'heading:6']);
    expect(turnIntoChoices('bullet_list')).toEqual(['ordered_list', 'todo']);
    expect(turnIntoChoices('todo')).toEqual(['bullet_list', 'ordered_list']);
  });

  it('offers nothing for any other block', () => {
    expect(turnIntoChoices('blockquote')).toEqual([]);
    expect(turnIntoChoices(null)).toEqual([]);
  });

  it('switches a whole list at once, keeping its items', () => {
    open('- [x] One\n- [ ] Two\n- [ ] Three\n');
    const view = editor!.view!;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)));
    editor!.run(commands.switchList('ordered_list'));
    expect(editor!.markdown()).toBe('1. One\n2. Two\n3. Three\n');
    editor!.run(commands.switchList('todo'));
    expect(editor!.markdown()).toBe('- [ ] One\n- [ ] Two\n- [ ] Three\n');
    editor!.run(commands.switchList('bullet_list'));
    expect(editor!.markdown()).toBe('- One\n- Two\n- Three\n');
  });
});
