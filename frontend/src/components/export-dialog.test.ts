// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import ExportDialog from './ExportDialog.svelte';

// Ark portals the content out of the component tree; every query waits for it.
async function setup(props: Record<string, unknown> = {}) {
  const onExport = vi.fn();
  const onCopy = vi.fn();
  const onSettings = vi.fn();
  const { app } = render(ExportDialog, {
    open: true,
    hasSelection: true,
    settings: { onlySelected: false, background: true, dark: false, scale: 2 },
    preview: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    onExport,
    onCopy,
    onSettings,
    ...props,
  } as never);
  await vi.waitFor(() => {
    if (props.open === false) return;
    expect(document.querySelector('.bava-export-preview')).not.toBeNull();
  });
  const button = (name: string) =>
    [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === name);
  const toggle = (name: string) =>
    [...document.querySelectorAll('label')].find((l) => (l.textContent ?? '').includes(name))?.querySelector('input');
  return { app, button, toggle, onExport, onCopy, onSettings };
}

describe('ExportDialog', () => {
  it('offers the two formats and copying, reporting which was asked for', async () => {
    const { button, onExport, onCopy } = await setup();
    button('PNG')!.click();
    expect(onExport).toHaveBeenCalledWith('png');
    button('SVG')!.click();
    expect(onExport).toHaveBeenCalledWith('svg');
    button('Copy to clipboard')!.click();
    expect(onCopy).toHaveBeenCalled();
  });

  it('reports each setting as it is changed', async () => {
    const { toggle, onSettings } = await setup();
    flushSync(() => toggle('Background')!.click());
    expect(onSettings).toHaveBeenCalledWith({ background: false });
    flushSync(() => toggle('Dark mode')!.click());
    expect(onSettings).toHaveBeenCalledWith({ dark: true });
  });

  // Ticking "only selected" with nothing selected would export an empty
  // picture, so the control stays visible and explains itself instead.
  it('disables Only selected when nothing is selected', async () => {
    const { toggle } = await setup({ hasSelection: false });
    expect(toggle('Only selected')!.disabled).toBe(true);
  });

  it('shows the preview it is handed', async () => {
    const preview = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="handed-in" width="4"></rect></svg>';
    await setup({ preview });
    expect(document.querySelector('.bava-export-preview')!.innerHTML).toBe(preview);
  });

  it('shows the scale it is set to', async () => {
    await setup();
    const checked = [...document.querySelectorAll('[data-part="item"][data-state="checked"]')];
    expect(checked.map((el) => el.textContent?.trim())).toContain('2×');
  });

  // The wrapper keeps the content mounted and marks it closed, so a reopen
  // does not rebuild the preview; what matters is that it is hidden.
  it('is hidden when it is closed', async () => {
    await setup({ open: false });
    const content = document.querySelector('.bava-dialog-content')!;
    expect(content.getAttribute('data-state')).toBe('closed');
    expect(content.hasAttribute('hidden')).toBe(true);
  });
});
