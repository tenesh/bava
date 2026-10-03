// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import TrashDialog from './TrashDialog.svelte';

describe('TrashDialog', () => {
  // Every row has the same two buttons; each names its item, so a screen
  // reader moving through them hears which page it would restore or delete.
  it('names the item on each row\'s Restore and Delete', async () => {
    render(TrashDialog, {
      open: true,
      items: [{ id: 'a1', path: 'Meeting notes/Q3 retro.md', kind: 'page', deletedAt: 'Today', size: '2 KB' }],
      total: '2 KB',
      onRestore: vi.fn(),
      onDelete: vi.fn(),
      onEmpty: vi.fn(),
      onOpenChange: vi.fn(),
    } as never);
    await vi.waitFor(() => expect(document.querySelector('.item')).not.toBeNull());
    const labels = [...document.querySelectorAll('.item button')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Restore Q3 retro', 'Delete Q3 retro']);
  });

  it('shows an attachment as a Media file, by its name', async () => {
    render(TrashDialog, {
      open: true,
      items: [{ id: 'b2', path: '.bava/attachments/logo.png', kind: 'attachment', deletedAt: 'Today', size: '1 KB' }],
      total: '1 KB',
      onRestore: vi.fn(),
      onDelete: vi.fn(),
      onEmpty: vi.fn(),
      onOpenChange: vi.fn(),
    } as never);
    await vi.waitFor(() => expect(document.querySelector('.item')).not.toBeNull());
    const row = document.querySelector('.item')!;
    expect(row.textContent).toContain('logo.png');
    expect(row.textContent).toContain('Media');
    expect(row.textContent).not.toContain('.bava');
  });
});
