import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { COMMAND_IDS, createDispatcher, type CommandHandlers } from './commands';

type SpecItem = { kind: string; id?: string; items?: SpecItem[] };

// The spec is the single source of the menu. Read it directly, so a menu item
// added in Go without a handler here fails this suite rather than doing nothing
// when clicked.
function specCommandIds(): string[] {
  const path = resolve(__dirname, '../../../internal/app/menu/spec.json');
  const spec = JSON.parse(readFileSync(path, 'utf8')) as { menus: SpecItem[] };
  const ids: string[] = [];
  const walk = (items: SpecItem[] = []) => {
    for (const item of items) {
      if (['command', 'radio', 'checkbox', 'recents'].includes(item.kind) && item.id) ids.push(item.id);
      walk(item.items);
    }
  };
  for (const menu of spec.menus) walk(menu.items);
  return ids;
}

function handlers(): CommandHandlers {
  return Object.fromEntries(COMMAND_IDS.map((id) => [id, vi.fn()])) as unknown as CommandHandlers;
}

describe('commands', () => {
  it('TestEverySpecCommandHasAHandler', () => {
    const known = new Set<string>(COMMAND_IDS);
    expect(specCommandIds().filter((id) => !known.has(id))).toEqual([]);
  });

  it('TestNoHandlerWithoutASpecEntry', () => {
    const spec = new Set(specCommandIds());
    expect(COMMAND_IDS.filter((id) => !spec.has(id))).toEqual([]);
  });

  it('dispatches a command with its argument', () => {
    const table = handlers();
    createDispatcher(table).dispatch({ id: 'file.openRecent', arg: '/a/b.md' });
    expect(table['file.openRecent']).toHaveBeenCalledWith('/a/b.md');
  });

  it('ignores an unknown command rather than throwing', () => {
    expect(() => createDispatcher(handlers()).dispatch({ id: 'nope' })).not.toThrow();
  });

  it('reports a failing handler instead of leaving an unhandled rejection', async () => {
    const table = handlers();
    const onError = vi.fn();
    const failure = new Error('disk full');
    table['file.save'] = () => Promise.reject(failure);
    await createDispatcher(table, { onError }).dispatch({ id: 'file.save' });
    expect(onError).toHaveBeenCalledWith('file.save', failure);
  });
});
