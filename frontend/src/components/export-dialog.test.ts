// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import ExportDialog from './ExportDialog.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

// Ark portals the content out of the component tree; every query waits for it.
async function render(props: Record<string, unknown> = {}) {
  const target = document.createElement('div');
  document.body.append(target);
  const onExport = vi.fn();
  const onCopy = vi.fn();
  const onSettings = vi.fn();
  const app = flushSync(() =>
    mount(ExportDialog, {
      target,
      props: {
        open: true,
        hasSelection: true,
        settings: { onlySelected: false, background: true, dark: false, scale: 2 },
        preview: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        onExport,
        onCopy,
        onSettings,
        ...props,
      } as never,
    }),
  );
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
    const { app, button, onExport, onCopy } = await render();
    button('PNG')!.click();
    expect(onExport).toHaveBeenCalledWith('png');
    button('SVG')!.click();
    expect(onExport).toHaveBeenCalledWith('svg');
    button('Copy to clipboard')!.click();
    expect(onCopy).toHaveBeenCalled();
    unmount(app);
  });

  it('reports each setting as it is changed', async () => {
    const { app, toggle, onSettings } = await render();
    flushSync(() => toggle('Background')!.click());
    expect(onSettings).toHaveBeenCalledWith({ background: false });
    flushSync(() => toggle('Dark mode')!.click());
    expect(onSettings).toHaveBeenCalledWith({ dark: true });
    unmount(app);
  });

  // Ticking "only selected" with nothing selected would export an empty
  // picture, so the control stays visible and explains itself instead.
  it('disables Only selected when nothing is selected', async () => {
    const { app, toggle } = await render({ hasSelection: false });
    expect(toggle('Only selected')!.disabled).toBe(true);
    unmount(app);
  });

  it('shows the preview it is handed', async () => {
    const { app } = await render();
    const preview = document.querySelector('.bava-export-preview')!;
    expect(preview.innerHTML).toContain('<svg');
    unmount(app);
  });

  it('shows the scale it is set to', async () => {
    const { app } = await render();
    const checked = [...document.querySelectorAll('[data-part="item"][data-state="checked"]')];
    expect(checked.map((el) => el.textContent?.trim())).toContain('2×');
    unmount(app);
  });

  // The wrapper keeps the content mounted and marks it closed, so a reopen
  // does not rebuild the preview; what matters is that it is hidden.
  it('is hidden when it is closed', async () => {
    const { app } = await render({ open: false });
    const content = document.querySelector('.bava-dialog-content')!;
    expect(content.getAttribute('data-state')).toBe('closed');
    expect(content.hasAttribute('hidden')).toBe(true);
    unmount(app);
  });
});
