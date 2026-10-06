// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render } from '../test/render';
import TemplatesDialog from './TemplatesDialog.svelte';

const TEMPLATES = [
  { group: 'Design', name: 'Spec', path: '.bava/templates/Design/Spec.md' },
  { group: 'Meetings', name: 'Retro', path: '.bava/templates/Meetings/Retro.md' },
  { group: 'Meetings', name: 'Weekly sync', path: '.bava/templates/Meetings/Weekly sync.md' },
  { group: '', name: 'Bug report', path: '.bava/templates/Bug report.md' },
];

async function setup(extra: Record<string, unknown> = {}) {
  const props = {
    open: true,
    templates: TEMPLATES,
    refusal: null,
    onNew: vi.fn(),
    onEdit: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onOpenChange: vi.fn(),
    ...extra,
  };
  render(TemplatesDialog, props as never);
  await vi.waitFor(() => expect(document.querySelector('.templates-list')).not.toBeNull());
  return props;
}

const headings = () => [...document.querySelectorAll('.templates-list h3')].map((h) => h.textContent?.trim());
const names = () => [...document.querySelectorAll('.templates-list .name')].map((n) => n.textContent?.trim());
const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === label)!;
const key = (target: Element, name: string) => flushSync(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })));
const type = (input: HTMLInputElement, text: string) => {
  input.value = text;
  flushSync(() => input.dispatchEvent(new Event('input', { bubbles: true })));
};

describe('TemplatesDialog', () => {
  it('lists each group\'s templates under it, then those in no group', async () => {
    await setup();
    expect(headings()).toEqual(['Design', 'Meetings', 'No group']);
    expect(names()).toEqual(['Spec', 'Retro', 'Weekly sync', 'Bug report']);
  });

  it('narrows the list as the search is typed', async () => {
    await setup();
    type(document.querySelector<HTMLInputElement>('input[type="search"]')!, 'sync');
    expect(names()).toEqual(['Weekly sync']);
    expect(headings()).toEqual(['Meetings']);
  });

  it('reports Edit, Duplicate and New template', async () => {
    const props = await setup();
    button('Edit Retro').click();
    expect(props.onEdit).toHaveBeenCalledWith('.bava/templates/Meetings/Retro.md');
    button('Duplicate Retro').click();
    expect(props.onDuplicate).toHaveBeenCalledWith('.bava/templates/Meetings/Retro.md');
    button('New template').click();
    expect(props.onNew).toHaveBeenCalled();
  });

  it('renames in a row, refusing a name its group has there', async () => {
    const props = await setup();
    flushSync(() => button('Rename Weekly sync').click());
    const field = document.querySelector<HTMLInputElement>('input.rename')!;
    type(field, 'Retro');
    key(field, 'Enter');
    expect(props.onRename).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')!.textContent).toContain('Retro');
    type(field, 'Daily');
    key(field, 'Enter');
    expect(props.onRename).toHaveBeenCalledWith('.bava/templates/Meetings/Weekly sync.md', 'Daily');
  });

  it('says so when the Space has no templates', async () => {
    await setup({ templates: [] });
    expect(document.querySelector('.templates-list')!.textContent).toContain('No templates yet');
  });
});
