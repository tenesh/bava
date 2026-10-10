// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import SpaceTree from './SpaceTree.svelte';
import type { SpaceEntry, TreeRow } from '../files/space.svelte';

const folders: Record<string, SpaceEntry[]> = {
  '': [
    { name: 'Marketing', path: 'Marketing', kind: 'folder' },
    { name: 'Roadmap.md', path: 'Roadmap.md', kind: 'page' },
  ],
  Marketing: [{ name: 'Launch plan.md', path: 'Marketing/Launch plan.md', kind: 'page' }],
};
const rows: TreeRow[] = [
  { entry: folders[''][0], depth: 0 },
  { entry: folders.Marketing[0], depth: 1 },
  { entry: folders[''][1], depth: 0 },
];

function base() {
  return {
    folders,
    rows,
    expanded: ['Marketing'],
    pending: null,
    activePath: 'Marketing/Launch plan.md',
    unsavedPath: 'Marketing/Launch plan.md',
    onToggle: vi.fn(),
    onOpen: vi.fn(),
    onRename: vi.fn(),
    onCommitNew: vi.fn(),
    onCancelNew: vi.fn(),
    onMove: vi.fn(),
    onTrash: vi.fn(),
    onContextMenu: vi.fn(),
  };
}

function setup(over: Record<string, unknown> = {}) {
  const handlers = {
    onToggle: vi.fn(),
    onOpen: vi.fn(),
    onRename: vi.fn(),
    onCommitNew: vi.fn(),
    onCancelNew: vi.fn(),
    onMove: vi.fn(),
    onTrash: vi.fn(),
    onContextMenu: vi.fn(),
    onRenameStarted: vi.fn(),
  };
  const { target, app } = render(SpaceTree, {
    folders,
    rows,
    expanded: ['Marketing'],
    pending: null,
    activePath: 'Marketing/Launch plan.md',
    unsavedPath: 'Marketing/Launch plan.md',
    ...handlers,
    ...over,
  });
  return { target, app, handlers };
}

describe('the Files tree', () => {
  it('shows pages by name without .md, under their open folder', () => {
    const { target } = setup();
    const names = [...target.querySelectorAll('.name')].map((el) => el.textContent?.trim());
    expect(names).toEqual(['Marketing', 'Launch plan', 'Roadmap']);
  });

  // Search shows a folder it found: its row brought into view and focused.
  it('brings a row it is asked to reveal into view, and focuses it', () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    try {
      const { target } = setup({ reveal: { path: 'Marketing', at: 1 } });
      flushSync();
      const row = target.querySelector<HTMLElement>('[data-path="Marketing"]')!;
      expect(scroll.mock.contexts).toContain(row);
      expect(document.activeElement).toBe(row);
    } finally {
      scroll.mockRestore();
    }
  });

  // Once shown, the row lets go: a later change to the tree must not pull
  // the keys back to it, where Backspace would trash the folder.
  it('reveals a row once, not again when the tree changes', () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    try {
      const props = $state({ ...base(), reveal: { path: 'Marketing', at: 1 } });
      render(SpaceTree, props);
      flushSync();
      const other = document.createElement('input');
      document.body.append(other);
      other.focus();
      props.rows = [...rows];
      flushSync();
      expect(document.activeElement).toBe(other);
      other.remove();
    } finally {
      scroll.mockRestore();
    }
  });

  it('marks the row its right-click menu is open for, and no other', () => {
    const { target } = setup({ menuPath: 'Roadmap.md' });
    const marked = [...target.querySelectorAll('[data-menu]')].map((row) => row.getAttribute('data-path'));
    expect(marked).toEqual(['Roadmap.md']);
  });

  it('marks the open page selected, with a dot while unsaved', () => {
    const { target } = setup();
    const row = target.querySelector('[data-path="Marketing/Launch plan.md"]');
    expect(row?.hasAttribute('data-selected')).toBe(true);
    expect(row?.querySelector('.dot')).not.toBeNull();
    // Announced, not only drawn.
    expect(row?.querySelector('.dot')?.getAttribute('role')).toBe('img');
    expect(row?.querySelector('.dot')?.getAttribute('aria-label')).toBeTruthy();
  });

  it('indents a row by its depth', () => {
    const { target } = setup();
    const row = target.querySelector<HTMLElement>('[data-path="Marketing/Launch plan.md"]');
    expect(row?.style.getPropertyValue('--depth')).toBe('1');
  });

  it('trashes the row Delete is pressed on', () => {
    const { target, handlers } = setup();
    const row = target.querySelector<HTMLElement>('[data-path="Roadmap.md"]')!;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(handlers.onTrash).toHaveBeenCalledWith('Roadmap.md');
  });

  it('shows the row being named', () => {
    const { target } = setup({ pending: { kind: 'page', folder: '' } });
    const names = [...target.querySelectorAll('.name')].map((el) => el.textContent?.trim());
    expect(names).toContain('Untitled');
  });
});

// Ark starts renaming in a microtask; let it and the effects settle.
async function settle() {
  for (let i = 0; i < 3; i += 1) {
    await Promise.resolve();
    flushSync();
  }
}

const renameInput = (target: HTMLElement) =>
  [...target.querySelectorAll<HTMLInputElement>('input.rename')].find((input) => !input.hidden);

const key = (el: Element, name: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

describe('naming in the Files tree', () => {
  it('opens the new row in its name field', async () => {
    const { target } = setup({ pending: { kind: 'page', folder: '' } });
    await settle();
    expect(renameInput(target)).toBeDefined();
  });

  it('cancels the new row on Escape', async () => {
    const { target, handlers } = setup({ pending: { kind: 'page', folder: '' } });
    await settle();
    key(renameInput(target)!, 'Escape');
    await settle();
    expect(handlers.onCancelNew).toHaveBeenCalled();
    expect(handlers.onCommitNew).not.toHaveBeenCalled();
  });

  it('submits the new row on Enter, without cancelling it', async () => {
    const { target, handlers } = setup({ pending: { kind: 'page', folder: '' } });
    await settle();
    const input = renameInput(target)!;
    input.value = 'Budget';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Enter');
    await settle();
    expect(handlers.onCommitNew).toHaveBeenCalledWith('Budget');
    expect(handlers.onCancelNew).not.toHaveBeenCalled();
  });

  it('starts a rename asked for a frame later, once a closing menu has taken focus back', async () => {
    const { target, handlers } = setup({ renameRequest: 'Roadmap.md' });
    await settle();
    expect(renameInput(target)).toBeFalsy();
    await new Promise((done) => requestAnimationFrame(done));
    await settle();
    expect(renameInput(target)).toBeTruthy();
    expect(handlers.onRenameStarted).toHaveBeenCalledTimes(1);
  });

  it('renames nothing when a rename is cancelled', async () => {
    const { target, handlers } = setup({ renameRequest: 'Roadmap.md' });
    await new Promise((done) => requestAnimationFrame(done));
    await settle();
    const input = renameInput(target)!;
    input.value = 'Other';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Escape');
    await settle();
    expect(handlers.onRename).not.toHaveBeenCalled();
  });
});

describe('dragging in the Files tree', () => {
  function dragEvent(type: string, clientY = 0) {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
  }

  it('moves a page dropped on the middle of a folder into it', () => {
    const { target, handlers } = setup();
    const page = target.querySelector<HTMLElement>('[data-path="Roadmap.md"]')!;
    const folder = target.querySelector<HTMLElement>('[data-path="Marketing"]')!;
    folder.getBoundingClientRect = () => ({ top: 0, height: 28 }) as DOMRect;
    page.dispatchEvent(dragEvent('dragstart'));
    flushSync();
    folder.dispatchEvent(dragEvent('dragover', 14));
    flushSync();
    expect(folder.dataset.drop).toBe('inside');
    folder.dispatchEvent(dragEvent('drop', 14));
    expect(handlers.onMove).toHaveBeenCalledWith('Roadmap.md', 'Marketing', -1);
  });

  it('refuses dropping a folder into what it holds', () => {
    const { target, handlers } = setup();
    const folder = target.querySelector<HTMLElement>('[data-path="Marketing"]')!;
    const inside = target.querySelector<HTMLElement>('[data-path="Marketing/Launch plan.md"]')!;
    inside.getBoundingClientRect = () => ({ top: 0, height: 28 }) as DOMRect;
    folder.dispatchEvent(dragEvent('dragstart'));
    flushSync();
    inside.dispatchEvent(dragEvent('dragover', 2));
    inside.dispatchEvent(dragEvent('drop', 2));
    expect(handlers.onMove).not.toHaveBeenCalled();
  });
});
