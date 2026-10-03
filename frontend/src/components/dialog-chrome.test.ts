// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from '../test/render';
import Dialog from './Dialog.svelte';

const snippet = (html: string) => createRawSnippet(() => ({ render: () => html }));

function setup(props: Record<string, unknown>) {
  const onOpenChange = vi.fn();
  const { app } = render(Dialog, { open: true, title: 'Trash', onOpenChange, children: snippet('<p class="inside">Body</p>'), ...props } as never);
  return { app, onOpenChange };
}

const q = (selector: string) => document.querySelector<HTMLElement>(selector);

describe('Dialog', () => {
  it('puts the title in a header, the content in a body, and the footer below', async () => {
    setup({ subtitle: 'Deleted items stay here', footer: snippet('<button>Done</button>') });
    await vi.waitFor(() => expect(q('.bava-dialog-header')).not.toBeNull());
    expect(q('.bava-dialog-header .bava-dialog-title')?.textContent).toBe('Trash');
    expect(q('.bava-dialog-header .bava-dialog-subtitle')?.textContent).toBe('Deleted items stay here');
    expect(q('.bava-dialog-body .inside')).not.toBeNull();
    expect(q('.bava-dialog-footer button')?.textContent).toBe('Done');
  });

  it('offers no close button unless asked', async () => {
    setup({});
    await vi.waitFor(() => expect(q('.bava-dialog-header')).not.toBeNull());
    expect(q('.bava-dialog-close')).toBeNull();
  });

  it('offers a close button when asked, and closes with it', async () => {
    const { onOpenChange } = setup({ closable: true });
    await vi.waitFor(() => expect(q('.bava-dialog-close')).not.toBeNull());
    expect(q('.bava-dialog-close')?.getAttribute('aria-label')).toBe('Close');
    q('.bava-dialog-close')!.click();
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('keeps a short alert in one box, with no header rule', async () => {
    setup({ variant: 'alert' });
    await vi.waitFor(() => expect(q('.bava-dialog-content')).not.toBeNull());
    expect(q('.bava-dialog-content')?.dataset.variant).toBe('alert');
    expect(q('.bava-dialog-header')).toBeNull();
    expect(q('.bava-dialog-title')?.textContent).toBe('Trash');
  });

  it('takes a named size, and a body that runs to the frame\'s edges', async () => {
    setup({ size: 'trash', flush: true });
    await vi.waitFor(() => expect(q('.bava-dialog-content')).not.toBeNull());
    expect(q('.bava-dialog-content')?.dataset.size).toBe('trash');
    expect(q('.bava-dialog-body')?.dataset.flush).toBe('true');
  });

  it('can hide its header from sight while still naming the dialog', async () => {
    setup({ headless: true });
    await vi.waitFor(() => expect(q('.bava-dialog-header')).not.toBeNull());
    expect(q('.bava-dialog-header')?.dataset.hidden).toBe('true');
    expect(q('.bava-dialog-title')?.textContent).toBe('Trash');
  });

  it('centres an alert with something above its title', async () => {
    setup({ variant: 'alert', align: 'center', leading: snippet('<span class="lead">Mark</span>') });
    await vi.waitFor(() => expect(q('.bava-dialog-content')).not.toBeNull());
    expect(q('.bava-dialog-content')?.dataset.align).toBe('center');
    const lead = q('.lead')!;
    expect(lead.compareDocumentPosition(q('.bava-dialog-title')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
