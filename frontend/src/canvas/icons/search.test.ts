import { describe, expect, it } from 'vitest';
import { searchIcons, ICON_RESULTS } from './search';
import type { IconEntry } from './sets';

const icon = (name: string, keywords: string[] = [], title = name): IconEntry => ({ set: 'line', name, title, keywords, body: '' });
const icons = [icon('server'), icon('chart-bar', ['data', 'statistics']), icon('database-export'), icon('database'), icon('file-database'), icon('mail', ['letter'])];

describe('searching icons', () => {
  it('lists a whole set in name order when nothing is typed', () => {
    expect(searchIcons(icons, '  ').map((i) => i.name)).toEqual(['chart-bar', 'database', 'database-export', 'file-database', 'mail', 'server']);
  });

  it('puts a name that starts with the words first, then one holding them, then a keyword', () => {
    expect(searchIcons(icons, 'data').map((i) => i.name)).toEqual(['database', 'database-export', 'file-database', 'chart-bar']);
  });

  it('reads spaces as the dashes in a name, and ignores case', () => {
    expect(searchIcons(icons, 'Database Ex').map((i) => i.name)).toEqual(['database-export']);
  });

  it("finds a logo by its title", () => {
    const logos = [icon('nodedotjs', ['node.js'], 'Node.js'), icon('postgresql', ['postgresql', 'postgres'], 'PostgreSQL')];
    expect(searchIcons(logos, 'node.').map((i) => i.name)).toEqual(['nodedotjs']);
    expect(searchIcons(logos, 'postgres').map((i) => i.name)).toEqual(['postgresql']);
  });

  it('stops at a screenful', () => {
    const many = Array.from({ length: 500 }, (_, n) => icon(`box-${n}`));
    expect(searchIcons(many, 'box')).toHaveLength(ICON_RESULTS);
  });
});
