// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import DocumentPane from './DocumentPane.svelte';

// jsdom lays nothing out: placing the bubble and the link field asks a text range for rectangles it has none of.
for (const name of ['getClientRects', 'getBoundingClientRect'] as const) {
  if (typeof Range.prototype[name] !== 'function') {
    Object.defineProperty(Range.prototype, name, { value: name === 'getClientRects' ? () => [] : () => new DOMRect(), configurable: true });
  }
}

/** The pane with a page open, every call to the app answered with nothing. */
function openPane(markdown: string) {
  const { target, app } = render(DocumentPane, {
    crumbs: ['Page'],
    spaceWidth: '',
    appWidth: '',
    onEdit: vi.fn(),
    onCounts: vi.fn(),
    onDuplicatePage: vi.fn(),
    onTrashPage: vi.fn(),
    onSaveTemplate: vi.fn(),
    onCopyText: vi.fn(),
    here: null,
    mediaPlace: null,
    readIndex: vi.fn().mockResolvedValue(null),
    onFollow: vi.fn(),
    onOpenPage: vi.fn(),
    onChooseMedia: vi.fn(),
    onOpenFile: vi.fn(),
    fileDetails: vi.fn().mockResolvedValue({ size: 0, modified: '' }),
    fetchCard: vi.fn().mockResolvedValue(null),
    onPasteImage: vi.fn(),
    onReplaceMedia: vi.fn().mockResolvedValue(null),
    onRenameAttachment: vi.fn(),
    onRevealFile: vi.fn(),
    onAttachPoster: vi.fn().mockResolvedValue(null),
    onNotify: vi.fn(),
  });
  flushSync(() => app.setPage(markdown));
  return target.querySelector<HTMLElement>('.ProseMirror')!;
}

/** Selects `words` where they first appear in the page, with the page focused, as a drag over them would. */
function select(page: HTMLElement, words: string) {
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.textContent!.indexOf(words);
    if (at < 0) continue;
    page.focus();
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + words.length);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    flushSync(() => document.dispatchEvent(new Event('selectionchange')));
    return;
  }
  throw new Error(`no "${words}" on the page`);
}

/** ⌘K, or Ctrl+K off a Mac, as the editor's keys read the platform. */
function pressLinkKey(page: HTMLElement) {
  const mod = /Mac|iP(hone|[oa]d)/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };
  flushSync(() => page.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ...mod, bubbles: true, cancelable: true })));
}

const bubble = () => document.querySelector('[role="toolbar"][aria-label="Formatting"]');
const linkField = () => document.querySelector<HTMLInputElement>('input[aria-label="Paste or type a link"]');
const buttonNamed = (name: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);

describe('DocumentPane', () => {
  it('shows the formatting bubble over words selected in a paragraph', () => {
    const page = openPane('Plain words here.\n');
    select(page, 'words');
    expect(bubble()).not.toBeNull();
  });

  it('hides the formatting bubble once the selection moves into a toggle summary, which takes no marks and turns into nothing', async () => {
    const page = openPane('Plain words here.\n\n<details open>\n<summary>What ships</summary>\n\nThe editor.\n\n</details>\n');
    select(page, 'words');
    await vi.waitFor(() => expect(bubble()).not.toBeNull());
    select(page, 'ships');
    expect(document.getSelection()?.toString()).toBe('ships');
    await vi.waitFor(() => expect(bubble()).toBeNull());
  });

  it('hides the formatting bubble once the selection moves into a code block, which takes no marks and turns into nothing', async () => {
    const page = openPane('Plain words here.\n\n```\nconst lines = 1;\n```\n');
    select(page, 'words');
    await vi.waitFor(() => expect(bubble()).not.toBeNull());
    select(page, 'lines');
    expect(document.getSelection()?.toString()).toBe('lines');
    await vi.waitFor(() => expect(bubble()).toBeNull());
  });

  it('opens the link field with no Remove link on text that has no link', async () => {
    const page = openPane('Plain words here.\n');
    select(page, 'words');
    pressLinkKey(page);
    await vi.waitFor(() => expect(linkField()).not.toBeNull());
    expect(linkField()!.value).toBe('');
    expect(buttonNamed('Remove link')).toBeUndefined();
  });

  it('opens the link field holding the address, with Remove link, on linked text', async () => {
    const page = openPane('See [the plan](https://example.com/plan) now.\n');
    select(page, 'the plan');
    pressLinkKey(page);
    await vi.waitFor(() => expect(linkField()).not.toBeNull());
    expect(linkField()!.value).toBe('https://example.com/plan');
    expect(buttonNamed('Remove link')).toBeDefined();
  });

  // The bubble draws in a root of its own, which can redraw after the pane
  // has dropped the bubble's place and before it takes the bubble down.
  it('takes the formatting bubble down without an error when the page loses focus', async () => {
    const page = openPane('Plain words here.\n');
    select(page, 'words');
    await vi.waitFor(() => expect(bubble()).not.toBeNull());
    expect(() => flushSync(() => page.blur())).not.toThrow();
    await vi.waitFor(() => expect(bubble()).toBeNull());
  });

  // A portal that mounts a moment after it is asked for must not mount once
  // the pane has already taken the bubble down.
  it('leaves no formatting bubble behind when the page loses focus before the bubble is drawn', async () => {
    const page = openPane('Plain words here.\n');
    select(page, 'words');
    flushSync(() => page.blur());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bubble()).toBeNull();
  });
});
