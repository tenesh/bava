import { describe, expect, it, vi } from 'vitest';
import { createWorkspace } from './workspace.svelte';

const entries = [
  { name: 'sub', path: '/w/sub', isDir: true },
  { name: 'arch.d2', path: '/w/arch.d2', isDir: false },
];

describe('workspace', () => {
  it('holds the listing for a folder', async () => {
    const io = { list: vi.fn().mockResolvedValue({ entries, error: '' }) };
    const workspace = createWorkspace(io);

    await workspace.open('/w');

    expect(workspace.root).toBe('/w');
    expect(workspace.entries).toHaveLength(2);
  });

  it('keeps the previous folder when a listing fails', async () => {
    const io = { list: vi.fn().mockResolvedValue({ entries, error: '' }) };
    const workspace = createWorkspace(io);
    await workspace.open('/w');

    io.list.mockResolvedValueOnce({ entries: null, error: 'no such directory' });
    await workspace.open('/gone');

    expect(workspace.error).toContain('no such directory');
    expect(workspace.root).toBe('/w');
  });

  it('treats a null listing as empty', async () => {
    const io = { list: vi.fn().mockResolvedValue({ entries: null, error: '' }) };
    const workspace = createWorkspace(io);
    await workspace.open('/empty');
    expect(workspace.entries).toEqual([]);
  });

  it('refreshes the current folder', async () => {
    const io = { list: vi.fn().mockResolvedValue({ entries, error: '' }) };
    const workspace = createWorkspace(io);
    await workspace.open('/w');
    await workspace.refresh();
    expect(io.list).toHaveBeenCalledTimes(2);
  });

  it('refreshing with no folder open does nothing', async () => {
    const io = { list: vi.fn() };
    await createWorkspace(io).refresh();
    expect(io.list).not.toHaveBeenCalled();
  });
});
