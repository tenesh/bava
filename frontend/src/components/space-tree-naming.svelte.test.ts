// @vitest-environment jsdom
// Runes, so the tree's props change the way the app changes them.
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import SpaceTree from './SpaceTree.svelte';
import type { SpaceEntry } from '../files/space.svelte';

async function settle() {
  for (let i = 0; i < 4; i += 1) {
    await Promise.resolve();
    flushSync();
  }
}

const renameInput = () => [...document.querySelectorAll<HTMLInputElement>('input.rename')].find((input) => !input.hidden);
const key = (el: Element, name: string) => el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));

describe('SpaceTree', () => {
  it('starts a second new row in its naming field, and Escape still cancels it', async () => {
    const entry = (name: string): SpaceEntry => ({ name: `${name}.md`, path: `${name}.md`, kind: 'page' });
    const state = $state({
      folders: { '': [entry('A')] } as Record<string, SpaceEntry[]>,
      pending: { kind: 'page', folder: '' } as { kind: 'page' | 'folder'; folder: string } | null,
    });
    const onCancelNew = vi.fn();
    render(SpaceTree, {
      get folders() {
        return state.folders;
      },
      rows: [],
      expanded: [],
      get pending() {
        return state.pending;
      },
      activePath: null,
      unsavedPath: null,
      onToggle: vi.fn(),
      onOpen: vi.fn(),
      onRename: vi.fn(),
      onCommitNew: vi.fn(),
      onCancelNew,
      onMove: vi.fn(),
      onTrash: vi.fn(),
      onContextMenu: vi.fn(),
    } as never);
    await settle();
    const first = renameInput()!;
    first.value = 'B';
    first.dispatchEvent(new Event('input', { bubbles: true }));
    key(first, 'Enter');
    await settle();
    // The app re-reads the tree with the new page, then stops naming.
    state.folders = { '': [entry('A'), entry('B')] };
    await settle();
    state.pending = null;
    await settle();
    // The next New Page.
    state.pending = { kind: 'page', folder: '' };
    await settle();
    const second = renameInput();
    expect(second).toBeDefined();
    expect(document.activeElement).toBe(second);
    key(second!, 'Escape');
    await settle();
    expect(onCancelNew).toHaveBeenCalled();
  });
});
