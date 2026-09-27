// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ShortcutsDialog from './ShortcutsDialog.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the shortcuts dialog', () => {
  it('puts each key of a shortcut on a cap of its own', async () => {
    const target = document.createElement('div');
    document.body.append(target);
    const groups = [
      { title: 'File', rows: [{ label: 'Open Space', keys: '⇧⌘O' }] },
      { title: 'Canvas', rows: [{ label: 'Snap to objects', keys: 'Alt+S' }] },
    ];
    const app = flushSync(() =>
      mount(ShortcutsDialog, { target, props: { open: true, title: 'Keyboard shortcuts', groups, onOpenChange: vi.fn() } }),
    );
    await vi.waitFor(() => expect(document.querySelector('.shortcuts')).not.toBeNull());

    const caps = (label: string) => {
      const row = [...document.querySelectorAll('.row')].find((r) => r.querySelector('dt')?.textContent === label)!;
      return [...row.querySelectorAll('kbd')].map((k) => k.textContent);
    };
    expect(caps('Open Space')).toEqual(['⇧', '⌘', 'O']);
    expect(caps('Snap to objects')).toEqual(['Alt', 'S']);
    unmount(app);
  });
});
