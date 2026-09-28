// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import SpaceTree from './SpaceTree.svelte';
import type { SpaceEntry, TreeRow } from '../files/space.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

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

function render(over: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
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
  const app = flushSync(() =>
    mount(SpaceTree, {
      target,
      props: {
        folders,
        rows,
        expanded: ['Marketing'],
        pending: null,
        activePath: 'Marketing/Launch plan.md',
        unsavedPath: 'Marketing/Launch plan.md',
        ...handlers,
        ...over,
      },
    }),
  );
  return { target, app, handlers };
}

describe('the Files tree', () => {
  it('shows pages by name without .md, under their open folder', () => {
    const { target, app } = render();
    const names = [...target.querySelectorAll('.name')].map((el) => el.textContent?.trim());
    expect(names).toEqual(['Marketing', 'Launch plan', 'Roadmap']);
    unmount(app);
  });

  it('marks the open page selected, with a dot while unsaved', () => {
    const { target, app } = render();
    const row = target.querySelector('[data-path="Marketing/Launch plan.md"]');
    expect(row?.hasAttribute('data-selected')).toBe(true);
    expect(row?.querySelector('.dot')).not.toBeNull();
    // Announced, not only drawn.
    expect(row?.querySelector('.dot')?.getAttribute('role')).toBe('img');
    expect(row?.querySelector('.dot')?.getAttribute('aria-label')).toBeTruthy();
    unmount(app);
  });

  it('indents a row by its depth', () => {
    const { target, app } = render();
    const row = target.querySelector<HTMLElement>('[data-path="Marketing/Launch plan.md"]');
    expect(row?.style.getPropertyValue('--depth')).toBe('1');
    unmount(app);
  });

  it('trashes the row Delete is pressed on', () => {
    const { target, app, handlers } = render();
    const row = target.querySelector<HTMLElement>('[data-path="Roadmap.md"]')!;
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(handlers.onTrash).toHaveBeenCalledWith('Roadmap.md');
    unmount(app);
  });

  it('shows the row being named', () => {
    const { target, app } = render({ pending: { kind: 'page', folder: '' } });
    const names = [...target.querySelectorAll('.name')].map((el) => el.textContent?.trim());
    expect(names).toContain('Untitled');
    unmount(app);
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
    const { target, app } = render({ pending: { kind: 'page', folder: '' } });
    await settle();
    expect(renameInput(target)).toBeDefined();
    unmount(app);
  });

  it('cancels the new row on Escape', async () => {
    const { target, app, handlers } = render({ pending: { kind: 'page', folder: '' } });
    await settle();
    key(renameInput(target)!, 'Escape');
    await settle();
    expect(handlers.onCancelNew).toHaveBeenCalled();
    expect(handlers.onCommitNew).not.toHaveBeenCalled();
    unmount(app);
  });

  it('submits the new row on Enter, without cancelling it', async () => {
    const { target, app, handlers } = render({ pending: { kind: 'page', folder: '' } });
    await settle();
    const input = renameInput(target)!;
    input.value = 'Budget';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Enter');
    await settle();
    expect(handlers.onCommitNew).toHaveBeenCalledWith('Budget');
    expect(handlers.onCancelNew).not.toHaveBeenCalled();
    unmount(app);
  });

  it('starts a rename asked for a frame later, once a closing menu has taken focus back', async () => {
    const { target, app, handlers } = render({ renameRequest: 'Roadmap.md' });
    await settle();
    expect(renameInput(target)).toBeFalsy();
    await new Promise((done) => requestAnimationFrame(done));
    await settle();
    expect(renameInput(target)).toBeTruthy();
    expect(handlers.onRenameStarted).toHaveBeenCalledTimes(1);
    unmount(app);
  });

  it('renames nothing when a rename is cancelled', async () => {
    const { target, app, handlers } = render({ renameRequest: 'Roadmap.md' });
    await new Promise((done) => requestAnimationFrame(done));
    await settle();
    const input = renameInput(target)!;
    input.value = 'Other';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Escape');
    await settle();
    expect(handlers.onRename).not.toHaveBeenCalled();
    unmount(app);
  });
});

describe('dragging in the Files tree', () => {
  function dragEvent(type: string, clientY = 0) {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientY });
  }

  it('moves a page dropped on the middle of a folder into it', () => {
    const { target, app, handlers } = render();
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
    unmount(app);
  });

  it('refuses dropping a folder into what it holds', () => {
    const { target, app, handlers } = render();
    const folder = target.querySelector<HTMLElement>('[data-path="Marketing"]')!;
    const inside = target.querySelector<HTMLElement>('[data-path="Marketing/Launch plan.md"]')!;
    inside.getBoundingClientRect = () => ({ top: 0, height: 28 }) as DOMRect;
    folder.dispatchEvent(dragEvent('dragstart'));
    flushSync();
    inside.dispatchEvent(dragEvent('dragover', 2));
    inside.dispatchEvent(dragEvent('drop', 2));
    expect(handlers.onMove).not.toHaveBeenCalled();
    unmount(app);
  });
});
