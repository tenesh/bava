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

describe('SpaceExportDialog writing a zip', () => {
  it('counts the files as they are written, and Cancel stops it', async () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();
    render(SpaceExportDialog, { open: true, spaceName: 'Acme Product', folders: [], target: '', plan, onTarget: vi.fn(), onExport: vi.fn(), writing: { done: 34, total: 210 }, onCancel, onClose });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(dialog().textContent).toContain('Writing 34 of 210');
    expect(button('Export zip')!.disabled).toBe(true);
    button('Cancel')!.click();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('changes nothing of what it writes while it writes', async () => {
    render(SpaceExportDialog, { open: true, spaceName: 'Acme Product', folders: ['Marketing'], target: '', plan, formats: ['zip', 'pdf'], onTarget: vi.fn(), onExport: vi.fn(), writing: { done: 34, total: 210 }, onCancel: vi.fn(), onClose: vi.fn() });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    await vi.waitFor(() => expect(dialog().querySelector<HTMLButtonElement>('.bava-select-trigger')!.disabled).toBe(true));
    await vi.waitFor(() => expect(dialog().querySelector('.bava-segment[data-value="pdf"]')!.hasAttribute('data-disabled')).toBe(true));
  });

  it('stays open on Escape while printing, and cancels', async () => {
    const onCancel = vi.fn();
    const onClose = vi.fn();
    render(SpaceExportDialog, { open: true, spaceName: 'Acme Product', folders: [], target: '', plan, onTarget: vi.fn(), onExport: vi.fn(), printing: 12, onCancel, onClose });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dialog().getAttribute('data-state')).toBe('open');
    expect(onClose).not.toHaveBeenCalled();
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

describe('SpaceExportDialog as a PDF', () => {
  const item = (text: string) => [...document.querySelectorAll<HTMLElement>('[data-part="item"]')].find((el) => (el.textContent ?? '').trim() === text);
  const pdf = { page: { html: '<div class="bava-print"><h1>Roadmap</h1></div>', css: '', widthPx: 640 }, canvas: null };

  it('starts on PDF and reports the setup, the theme and numbers', async () => {
    const onExportPdf = vi.fn();
    render(SpaceExportDialog, { open: true, spaceName: 'Acme Product', folders: [], target: '', plan, onTarget: vi.fn(), onExport: vi.fn(), formats: ['pdf', 'zip'], paper: 'Letter', pdf, onExportPdf });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(dialog().querySelector('[data-name="Paper"] .bava-select-trigger')?.textContent?.trim()).toBe('Letter');
    item('Dark')!.click();
    await vi.waitFor(() => expect(item('Dark')?.hasAttribute('data-state') && item('Dark')?.getAttribute('data-state')).toBe('checked'));
    button('Export PDF')!.click();
    expect(onExportPdf).toHaveBeenCalledWith(expect.objectContaining({ dark: true, numbers: false, setup: expect.objectContaining({ paper: 'Letter' }) }));
  });

  it('says how far the drawing has gone, and offers no second export meanwhile', async () => {
    render(SpaceExportDialog, { open: true, spaceName: 'Acme Product', folders: [], target: '', plan, onTarget: vi.fn(), onExport: vi.fn(), formats: ['pdf', 'zip'], pdf, drawing: { done: 3, total: 12 }, onExportPdf: vi.fn() });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    expect(dialog().textContent).toContain('Drawing 3 of 12');
    expect(button('Export PDF')?.disabled).toBe(true);
  });

  it('still exports a zip', async () => {
    const onExport = vi.fn();
    render(SpaceExportDialog, { open: true, spaceName: 'Acme Product', folders: [], target: '', plan, onTarget: vi.fn(), onExport, formats: ['pdf', 'zip'], pdf, onExportPdf: vi.fn() });
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    item('Markdown zip')!.click();
    await vi.waitFor(() => expect(button('Export zip')).toBeDefined());
    button('Export zip')!.click();
    expect(onExport).toHaveBeenCalledOnce();
  });
});
