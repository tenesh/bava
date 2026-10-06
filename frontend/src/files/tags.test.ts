import { describe, expect, it } from 'vitest';
import { filteredRows, retag, tagsIn } from './tags';

const page = (path: string, tags: string, rest = 'Text\n') => ({ name: path.replace(/^.*\//, '').replace(/\.md$/, ''), path, text: tags ? `---\ntags: ${tags}\n---\n${rest}` : rest });

const PAGES = [
  page('Roadmap.md', '[launch, Q4]'),
  page('Marketing/Launch plan.md', '[launch, q4, road-map]'),
  page('Marketing/Press release.md', '[launch]'),
  page('Engineering/Notes.md', ''),
];

describe('the tags of a Space', () => {
  it('lists each tag, converted, with the pages that have it, by name', () => {
    expect(tagsIn(PAGES)).toEqual([
      { tag: 'launch', pages: ['Roadmap.md', 'Marketing/Launch plan.md', 'Marketing/Press release.md'] },
      { tag: 'q4', pages: ['Roadmap.md', 'Marketing/Launch plan.md'] },
      { tag: 'road-map', pages: ['Marketing/Launch plan.md'] },
    ]);
  });
});

describe('a page retagged', () => {
  const text = '---\ntitle: T\ntags:\n  - launch\n  - q4\n---\nSome __hand__ written *text*.\n';

  it('renames a tag, changing only the tags key', () => {
    expect(retag(text, ['launch'], 'release')).toBe('---\ntitle: T\ntags: [release, q4]\n---\nSome __hand__ written *text*.\n');
  });

  it('merges several into one, kept once where the page had both', () => {
    expect(retag(text, ['launch', 'q4'], 'q4')).toBe('---\ntitle: T\ntags: [q4]\n---\nSome __hand__ written *text*.\n');
  });

  it('deletes a tag, the page kept', () => {
    expect(retag(text, ['launch', 'q4'], null)).toBe('---\ntitle: T\n---\nSome __hand__ written *text*.\n');
  });

  it('keeps a page written with Windows line endings in them, header and all', () => {
    expect(retag('---\r\ntags: [launch]\r\ntitle: T\r\n---\r\nLine one\r\nLine two\r\n', ['launch'], 'release')).toBe(
      '---\r\ntags: [release]\r\ntitle: T\r\n---\r\nLine one\r\nLine two\r\n',
    );
  });

  it('leaves a page without the tag alone', () => {
    expect(retag(text, ['design'], 'x')).toBeNull();
    expect(retag('Text\n', ['launch'], null)).toBeNull();
  });

  it('matches a tag another tool wrote with capitals', () => {
    expect(retag('---\ntags: [Launch]\n---\nT\n', ['launch'], 'release')).toBe('---\ntags: [release]\n---\nT\n');
  });
});

describe('the Files tree filtered by tags', () => {
  const names = (rows: ReturnType<typeof filteredRows>) => rows.map((row) => `${'  '.repeat(row.depth)}${row.entry.name}`);

  it('holds the pages with all the chosen tags, and the folders that lead to them', () => {
    expect(names(filteredRows(PAGES, ['launch', 'q4'], () => undefined))).toEqual(['Marketing', '  Launch plan.md', 'Roadmap.md']);
  });

  it('keeps the tree\'s own order where it is known', () => {
    const order = (folder: string) => (folder === '' ? ['Roadmap.md', 'Marketing'] : undefined);
    expect(names(filteredRows(PAGES, ['launch', 'q4'], order))).toEqual(['Roadmap.md', 'Marketing', '  Launch plan.md']);
  });

  it('holds nothing when no page has them all', () => {
    expect(filteredRows(PAGES, ['road-map', 'design'], () => undefined)).toEqual([]);
  });
});

describe('a tag change across the Space', () => {
  it('rewrites each other page that has the tag, leaving the open page to its editor', async () => {
    const { tagEdits } = await import('./tags');
    const edits = tagEdits(PAGES, 'Marketing/Launch plan.md', ['launch'], 'release');
    expect(edits.map((edit) => edit.path)).toEqual(['Roadmap.md', 'Marketing/Press release.md']);
    expect(edits[0]).toEqual({ path: 'Roadmap.md', before: PAGES[0].text, after: '---\ntags: [release, q4]\n---\nText\n' });
  });

  it('counts the pages a change reaches, the open one included', async () => {
    const { pagesWith } = await import('./tags');
    expect(pagesWith(tagsIn(PAGES), ['q4', 'road-map'])).toBe(2);
  });
});

describe('the filtered tree as folders', () => {
  it('gives each folder the entries the rows put in it, in order', async () => {
    const { foldersOf } = await import('./tags');
    const rows = filteredRows(PAGES, ['launch', 'q4'], () => undefined);
    expect(foldersOf(rows)).toEqual({
      '': [
        { name: 'Marketing', path: 'Marketing', kind: 'folder' },
        { name: 'Roadmap.md', path: 'Roadmap.md', kind: 'page' },
      ],
      Marketing: [{ name: 'Launch plan.md', path: 'Marketing/Launch plan.md', kind: 'page' }],
    });
  });
});

describe('a tag change and a locked page', () => {
  it('leaves a locked page as it is, and names it', async () => {
    const { tagEdits, lockedWith } = await import('./tags');
    const locked = { name: 'Plan', path: 'Plan.md', text: '---\ntags: [launch]\nbava:\n  locked: true\n---\nT\n' };
    const pages = [...PAGES, locked];
    expect(tagEdits(pages, null, ['launch'], 'release').map((edit) => edit.path)).not.toContain('Plan.md');
    expect(lockedWith(pages, ['launch'])).toEqual(['Plan.md']);
    expect(lockedWith(pages, ['q4'])).toEqual([]);
  });
});

