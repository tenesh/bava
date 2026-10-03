// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import DiagramDialog from './DiagramDialog.svelte';
import type { Diagnostic } from '../../bindings/github.com/tenesh/bava/internal/render/models';

const broken: Diagnostic[] = [{ message: 'expected a name', line: 1, from: 0, to: 1 }];

async function setup(errors: Diagnostic[]) {
  const props = $state({
    open: true,
    source: 'a -> b',
    preview: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    errors,
    pending: false,
    shapes: 2,
    engine: 'tala' as const,
    direction: 'down' as const,
    onEngine: vi.fn(),
    onDirection: vi.fn(),
    onSource: vi.fn(),
    onInsert: vi.fn(),
    onOpenChange: vi.fn(),
  });
  render(DiagramDialog, props);
  await vi.waitFor(() => expect(document.querySelector('.cm-editor')).not.toBeNull());
  return props;
}

const marked = () => document.querySelector('.cm-editor .cm-lintRange-error');

describe('DiagramDialog diagnostics in the editor', () => {
  it('marks an error the dialog opens with in the editor, not only in the list', async () => {
    await setup(broken);
    await vi.waitFor(() => expect(marked()).not.toBeNull());
  });

  it('marks an error that arrives after the editor exists', async () => {
    const props = await setup([]);
    expect(marked()).toBeNull();
    flushSync(() => (props.errors = broken));
    await vi.waitFor(() => expect(marked()).not.toBeNull());
  });

  it('clears the mark when the error goes away', async () => {
    const props = await setup(broken);
    await vi.waitFor(() => expect(marked()).not.toBeNull());
    flushSync(() => (props.errors = []));
    await vi.waitFor(() => expect(marked()).toBeNull());
  });
});
