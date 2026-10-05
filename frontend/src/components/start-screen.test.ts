// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '../test/render';
import StartScreen from './StartScreen.svelte';

const RECENTS = [
  { path: '/Users/you/Acme', name: 'Acme', when: '26 Sep' },
  { path: '/Users/you/Gone', name: 'Gone', when: '20 Sep', missing: true },
];

function setup() {
  const props = { recents: RECENTS, onNewSpace: vi.fn(), onOpenSpace: vi.fn(), onOpenFile: vi.fn(), onOpenRecent: vi.fn(), onRemoveRecent: vi.fn() };
  render(StartScreen, props);
  return props;
}

const remove = (name: string) => document.querySelector<HTMLButtonElement>(`button[aria-label="Remove ${name} from list"]`)!;

describe('the start screen’s recent Spaces', () => {
  it('removes a Space from the list by its own button, opening nothing', () => {
    const props = setup();
    remove('Acme').click();
    expect(props.onRemoveRecent).toHaveBeenCalledWith('/Users/you/Acme');
    expect(props.onOpenRecent).not.toHaveBeenCalled();
  });

  it('removes a Space whose folder is gone, while its row cannot open', () => {
    const props = setup();
    expect(document.querySelector<HTMLButtonElement>('.recent[disabled]')).not.toBeNull();
    expect(remove('Gone').disabled).toBe(false);
    expect(remove('Gone').closest('[data-missing]')).not.toBeNull();
    remove('Gone').click();
    expect(props.onRemoveRecent).toHaveBeenCalledWith('/Users/you/Gone');
  });

  it('puts each remove button after its row, outside it, so Tab reaches it next', () => {
    setup();
    const row = document.querySelector('.recent')!;
    expect(row.contains(remove('Acme'))).toBe(false);
    expect(row.compareDocumentPosition(remove('Acme')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row.compareDocumentPosition(remove('Gone')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(remove('Acme').compareDocumentPosition(document.querySelectorAll('.recent')[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
