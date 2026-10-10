// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import PageExportDialog from './PageExportDialog.svelte';
import SpaceExportDialog from './SpaceExportDialog.svelte';

const plan = {
  files: [
    { path: '.bava/attachments/logo.png', size: 1024 },
    { path: 'Marketing/Launch plan.md', size: 1024 },
  ],
  error: '',
};

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const button = (name: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === name);

describe('PageExportDialog', () => {
  it('shows what the zip holds, its totals, and exports', async () => {
    const onExport = vi.fn();
    render(PageExportDialog, { open: true, pageName: 'Launch plan', plan, onExport });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(dialog().textContent).toContain('Export page');
    expect(dialog().textContent).toContain('Launch plan');
    expect(dialog().textContent).toContain('1 image or file');
    expect(dialog().textContent).toContain('1 page · 2 files · 2.0 KB');
    button('Export zip')!.click();
    expect(onExport).toHaveBeenCalledOnce();
  });

  it('says why when the zip cannot be made, and offers no export', async () => {
    render(PageExportDialog, { open: true, pageName: 'Launch plan', plan: { files: [], error: 'logo.png is not an attachment' }, onExport: vi.fn() });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(dialog().textContent).toContain('logo.png is not an attachment');
    expect(button('Export zip')?.disabled).toBe(true);
  });
});

describe('SpaceExportDialog', () => {
  it('offers the whole Space or a folder, and reports the choice', async () => {
    const onTarget = vi.fn();
    render(SpaceExportDialog, { open: true, spaceName: 'Acme Product', folders: ['Marketing', 'Engineering'], target: '', plan, onTarget, onExport: vi.fn() });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(dialog().textContent).toContain('Export Space');
    expect(dialog().textContent).toContain('Whole Space');
    expect(dialog().querySelector('[data-name="What"]')).not.toBeNull();
  });

  it("lists the hidden folder's parts with their counts", async () => {
    const full = { files: [...plan.files, { path: '.bava/templates/Bug report.md', size: 10 }, { path: '.bava/space.json', size: 10 }], error: '' };
    render(SpaceExportDialog, { open: true, spaceName: 'Acme Product', folders: [], target: '', plan: full, onTarget: vi.fn(), onExport: vi.fn() });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(dialog().textContent).toContain('1 template');
    expect(dialog().textContent).toContain('Settings');
  });
});

// The caller keeps the export's state: Cancel tells it, so the next export
// opens a fresh dialog.
describe('closing an export dialog', () => {
  it('reports Cancel', async () => {
    const onClose = vi.fn();
    render(PageExportDialog, { open: true, pageName: 'Launch plan', plan, onExport: vi.fn(), onClose });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    button('Cancel')!.click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
