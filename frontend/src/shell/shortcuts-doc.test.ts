import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import spec from '../../../internal/app/menu/spec.json';
import { shortcutGroups, type MenuSpec } from './shortcuts';

/**
 * `docs/shortcuts.md` is written by hand but checked against the menu spec, so
 * a shortcut added to the menu without its documentation fails the suite.
 */
function expectedRows(): string[] {
  const mac = shortcutGroups(spec as MenuSpec, 'darwin');
  const other = shortcutGroups(spec as MenuSpec, 'windows');
  const titles = [...new Set([...mac, ...other].map((g) => g.title))];

  return titles.flatMap((title) => {
    const macRows = mac.find((g) => g.title === title)?.rows ?? [];
    const otherRows = other.find((g) => g.title === title)?.rows ?? [];
    const labels = [...new Set([...macRows, ...otherRows].map((r) => r.label))];
    return labels.map((label) => {
      const m = macRows.find((r) => r.label === label)?.keys;
      const o = otherRows.find((r) => r.label === label)?.keys;
      const cell = (keys: string | undefined) => (keys ? `\`${keys}\`` : '—');
      return `| ${title} | ${label} | ${cell(m)} | ${cell(o)} |`;
    });
  });
}

describe('docs/shortcuts.md', () => {
  it('lists every menu shortcut exactly as the menu binds it', () => {
    const doc = readFileSync(resolve(__dirname, '../../../docs/shortcuts.md'), 'utf8');
    const missing = expectedRows().filter((row) => !doc.includes(row));
    expect(missing).toEqual([]);
  });
});
