// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import ImportDialog from './ImportDialog.svelte';
import type { ImportPlan } from '../files/space.svelte';

const plan: ImportPlan = {
  into: 'Marketing',
  origins: [{ path: '/d/Q4 notes', root: '/d' }],
  entries: [
    { kind: 'folder', origin: 0, from: 'Q4 notes', entry: '', to: 'Marketing/Q4 notes 2', size: 0 },
    { kind: 'page', origin: 0, from: 'Q4 notes/Goals.md', entry: '', to: 'Marketing/Q4 notes 2/Goals.md', size: 10 },
  ],
  renames: [{ from: 'Q4 notes', to: 'Q4 notes 2' }],
  skipped: [],
  pages: 1,
  files: 0,
  templates: 0,
  bytes: 10,
} as ImportPlan;

// Ark portals the content out of the component tree; every query waits for it.
async function setup(props: Record<string, unknown> = {}) {
  const onInto = vi.fn();
  const onImport = vi.fn();
  const onCancel = vi.fn();
  render(ImportDialog, {
    open: true,
    source: 'Q4 notes',
    folders: ['Marketing', 'Engineering'],
    into: 'Marketing',
    plan: { plan, error: '' },
    progress: null,
    onInto,
    onImport,
    onCancel,
    ...props,
  } as never);
  await vi.waitFor(() => expect(document.querySelector('.bava-import')).not.toBeNull());
  const button = (name: string) => [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === name);
  const text = () => document.querySelector('.bava-dialog-content')?.textContent ?? '';
  return { button, text, onInto, onImport, onCancel };
}

describe('ImportDialog', () => {
  it('shows what comes in, where, and what was renamed to keep both', async () => {
    const { text } = await setup();
    expect(text()).toContain('From Q4 notes');
    expect(text()).toContain('Q4 notes 2');
    expect(text()).toContain('Goals');
    expect(text()).toContain('Renamed to keep both');
    expect(text()).toContain('1 page · 0 files · 10 B');
  });

  it('says nothing of renames when nothing was renamed', async () => {
    const { text } = await setup({ plan: { plan: { ...plan, renames: [] }, error: '' } });
    expect(text()).not.toContain('Renamed to keep both');
  });

  it('lists what stays behind for its name, by name', async () => {
    const { text } = await setup({ plan: { plan: { ...plan, skipped: ['Q4 notes/Plan: Q4.md', 'Q4 notes/Old?'] }, error: '' } });
    expect(text()).toContain('Left behind');
    expect(text()).toContain("A Space can't hold these names. Rename them where they are, then import again.");
    expect(text()).toContain('Plan: Q4.md');
    expect(text()).toContain('Old?');
    expect(text()).not.toContain('Q4 notes/Plan');
  });

  it('says nothing of what stays behind when nothing does', async () => {
    const { text } = await setup();
    expect(text()).not.toContain('Left behind');
  });

  it('imports when asked', async () => {
    const { button, onImport } = await setup();
    button('Import')!.click();
    expect(onImport).toHaveBeenCalled();
  });

  it('counts while importing, and Cancel stops it', async () => {
    const { button, text, onCancel } = await setup({ progress: { done: 5, total: 12 } });
    expect(text()).toContain('Importing 5 of 12');
    expect(button('Import')!.disabled).toBe(true);
    button('Cancel')!.click();
    expect(onCancel).toHaveBeenCalled();
  });

  it('offers no Cancel once everything is in, while its links are written', async () => {
    const { button } = await setup({ progress: { done: 12, total: 12 } });
    expect(button('Cancel')!.disabled).toBe(true);
  });

  it('stays open on Escape while importing, and cancels', async () => {
    const { onCancel } = await setup({ progress: { done: 5, total: 12 } });
    document.querySelector<HTMLElement>('.bava-dialog-content')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector('.bava-dialog-content')?.getAttribute('data-state')).toBe('open');
  });

  it('cannot import, or change where to, while the plan is read', async () => {
    const reading = await setup({ plan: null });
    expect(reading.button('Import')!.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('.bava-import .bava-select-trigger')!.disabled).toBe(true);
  });

  it('shows why an import cannot be made', async () => {
    const { text, button } = await setup({ plan: { plan: null, error: 'That is not a page, a folder or a zip Bava can open.' } });
    expect(text()).toContain('That is not a page, a folder or a zip Bava can open.');
    expect(button('Import')!.disabled).toBe(true);
  });
});
