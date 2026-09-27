// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import Dialog from './Dialog.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

const snippet = (html: string) => createRawSnippet(() => ({ render: () => html }));

function render(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.append(target);
  const onOpenChange = vi.fn();
  const app = flushSync(() =>
    mount(Dialog, { target, props: { open: true, title: 'Trash', onOpenChange, children: snippet('<p class="inside">Body</p>'), ...props } as never }),
  );
  return { app, onOpenChange };
}

const q = (selector: string) => document.querySelector<HTMLElement>(selector);

describe('the dialog frame', () => {
  it('puts the title in a header, the content in a body, and the footer below', async () => {
    const { app } = render({ subtitle: 'Deleted items stay here', footer: snippet('<button>Done</button>') });
    await vi.waitFor(() => expect(q('.bava-dialog-header')).not.toBeNull());
    expect(q('.bava-dialog-header .bava-dialog-title')?.textContent).toBe('Trash');
    expect(q('.bava-dialog-header .bava-dialog-subtitle')?.textContent).toBe('Deleted items stay here');
    expect(q('.bava-dialog-body .inside')).not.toBeNull();
    expect(q('.bava-dialog-footer button')?.textContent).toBe('Done');
    unmount(app);
  });

  it('offers a close button only when asked, and closes with it', async () => {
    const plain = render({});
    await vi.waitFor(() => expect(q('.bava-dialog-header')).not.toBeNull());
    expect(q('.bava-dialog-close')).toBeNull();
    unmount(plain.app);
    document.body.innerHTML = '';
    const { app, onOpenChange } = render({ closable: true });
    await vi.waitFor(() => expect(q('.bava-dialog-close')).not.toBeNull());
    expect(q('.bava-dialog-close')?.getAttribute('aria-label')).toBe('Close');
    q('.bava-dialog-close')!.click();
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    unmount(app);
  });

  it('keeps a short alert in one box, with no header rule', async () => {
    const { app } = render({ variant: 'alert' });
    await vi.waitFor(() => expect(q('.bava-dialog-content')).not.toBeNull());
    expect(q('.bava-dialog-content')?.dataset.variant).toBe('alert');
    expect(q('.bava-dialog-header')).toBeNull();
    expect(q('.bava-dialog-title')?.textContent).toBe('Trash');
    unmount(app);
  });

  it('takes a named size, and a body that runs to the frame\'s edges', async () => {
    const { app } = render({ size: 'trash', flush: true });
    await vi.waitFor(() => expect(q('.bava-dialog-content')).not.toBeNull());
    expect(q('.bava-dialog-content')?.dataset.size).toBe('trash');
    expect(q('.bava-dialog-body')?.dataset.flush).toBe('true');
    unmount(app);
  });

  it('can hide its header from sight while still naming the dialog', async () => {
    const { app } = render({ headless: true });
    await vi.waitFor(() => expect(q('.bava-dialog-header')).not.toBeNull());
    expect(q('.bava-dialog-header')?.dataset.hidden).toBe('true');
    expect(q('.bava-dialog-title')?.textContent).toBe('Trash');
    unmount(app);
  });

  it('centres an alert with something above its title', async () => {
    const { app } = render({ variant: 'alert', align: 'center', leading: snippet('<span class="lead">Mark</span>') });
    await vi.waitFor(() => expect(q('.bava-dialog-content')).not.toBeNull());
    expect(q('.bava-dialog-content')?.dataset.align).toBe('center');
    const lead = q('.lead')!;
    expect(lead.compareDocumentPosition(q('.bava-dialog-title')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount(app);
  });
});
