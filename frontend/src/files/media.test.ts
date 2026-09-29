import { describe, expect, it } from 'vitest';
import { mediaItems, mediaUsage, shownItems, type MediaItem } from './media';

const files = [
  { name: 'logo.png', size: 1_000, modified: '2026-09-01T10:00:00Z' },
  { name: 'demo.mp4', size: 90_000, modified: '2026-09-03T10:00:00Z' },
  { name: 'still.png', size: 3_000, modified: '2026-09-02T10:00:00Z' },
  { name: 'Q3 report.pdf', size: 20_000, modified: '2026-09-04T10:00:00Z' },
  { name: 'site icon.png', size: 500, modified: '2026-09-05T10:00:00Z' },
  { name: 'Café menu.docx', size: 7_000, modified: '2026-09-06T10:00:00Z' },
  { name: 'old.png', size: 2_000, modified: '2026-08-01T10:00:00Z' },
];

const pages = [
  { name: 'Home', path: 'Home.md', text: '![Logo](.bava/attachments/logo.png)\n\nSee `[x](.bava/attachments/old.png)` in code.\n' },
  { name: 'Launch', path: 'Marketing/Launch.md', text: '<!-- bava: poster="still.png" -->\n![Demo](../.bava/attachments/demo.mp4)\n\n<!-- bava: card -->\n[Q3 report.pdf](../.bava/attachments/Q3%20report.pdf)\n' },
  { name: 'Links', path: 'Links.md', text: '<!-- bava: card icon="site icon.png" -->\n[Site](https://example.com)\n\n![Logo again](.bava/attachments/logo.png)\n' },
];

const byName = (items: MediaItem[]) => Object.fromEntries(items.map((item) => [item.name, item]));
const unusedNames = (files: { name: string; size: number; modified: string }[], text: string) =>
  mediaItems(files, [{ name: 'P', path: 'Notes/P.md', text }]).filter((item) => item.unused).map((item) => item.name);

describe('which pages use each attachment', () => {
  const items = byName(mediaItems(files, pages));

  it('is found through an image, a video, a card, a poster and an icon, from pages in folders', () => {
    expect(items['logo.png'].usedBy.map((p) => p.path)).toEqual(['Home.md', 'Links.md']);
    expect(items['demo.mp4'].usedBy.map((p) => p.path)).toEqual(['Marketing/Launch.md']);
    expect(items['still.png'].usedBy.map((p) => p.path)).toEqual(['Marketing/Launch.md']);
    expect(items['Q3 report.pdf'].usedBy.map((p) => p.path)).toEqual(['Marketing/Launch.md']);
    expect(items['site icon.png'].usedBy.map((p) => p.path)).toEqual(['Links.md']);
  });

  it('is none for a file no page names; one named anywhere, even in code, is kept as used', () => {
    expect(items['old.png'].unused).toBe(false);
    expect(items['old.png'].usedBy.map((p) => p.path)).toEqual(['Home.md']);
    expect(items['Café menu.docx'].unused).toBe(true);
    expect(items['logo.png'].unused).toBe(false);
  });

  it('knows each file’s kind, and a video’s poster from the page that shows it', () => {
    expect(items['logo.png'].kind).toBe('image');
    expect(items['demo.mp4'].kind).toBe('video');
    expect(items['demo.mp4'].poster).toBe('still.png');
    expect(items['Q3 report.pdf'].kind).toBe('pdf');
    expect(items['Café menu.docx'].kind).toBe('other');
  });
});

describe('what the Media list shows', () => {
  const items = mediaItems(files, pages);
  const names = (list: MediaItem[]) => list.map((item) => item.name);

  it('filters by kind, and to the unused', () => {
    expect(names(shownItems(items, { filter: 'images', search: '', sort: 'name' }))).toEqual(['logo.png', 'old.png', 'site icon.png', 'still.png']);
    expect(names(shownItems(items, { filter: 'videos', search: '', sort: 'name' }))).toEqual(['demo.mp4']);
    expect(names(shownItems(items, { filter: 'pdfs', search: '', sort: 'name' }))).toEqual(['Q3 report.pdf']);
    expect(names(shownItems(items, { filter: 'other', search: '', sort: 'name' }))).toEqual(['Café menu.docx']);
    expect(names(shownItems(items, { filter: 'unused', search: '', sort: 'name' }))).toEqual(['Café menu.docx']);
  });

  it('searches names, ignoring case and accents', () => {
    expect(names(shownItems(items, { filter: 'all', search: 'CAFE', sort: 'name' }))).toEqual(['Café menu.docx']);
    expect(names(shownItems(items, { filter: 'all', search: ' logo ', sort: 'name' }))).toEqual(['logo.png']);
  });

  it('sorts by name, by size largest first, or by date newest first', () => {
    expect(names(shownItems(items, { filter: 'all', search: '', sort: 'name' }))[0]).toBe('Café menu.docx');
    expect(names(shownItems(items, { filter: 'all', search: '', sort: 'size' }))).toEqual([
      'demo.mp4',
      'Q3 report.pdf',
      'Café menu.docx',
      'still.png',
      'old.png',
      'logo.png',
      'site icon.png',
    ]);
    expect(names(shownItems(items, { filter: 'all', search: '', sort: 'date' }))[0]).toBe('Café menu.docx');
    expect(names(shownItems(items, { filter: 'all', search: '', sort: 'date' })).at(-1)).toBe('old.png');
  });
});

describe('a file a page reaches in any other way', () => {
  const one = (name: string) => [{ name, size: 1, modified: '2026-09-01T00:00:00Z' }];

  it('is used, never unused: in a line of text, a list, a table, a heading, by reference or in HTML', () => {
    for (const text of [
      'Shot: ![](../.bava/attachments/s.png) here.\n',
      '- ![x](../.bava/attachments/s.png)\n',
      '| a |\n|---|\n| ![x](../.bava/attachments/s.png) |\n',
      '# Title ![x](../.bava/attachments/s.png)\n',
      '![x][r]\n\n[r]: ../.bava/attachments/s.png\n',
      '<img src="../.bava/attachments/s.png">\n',
      '[![x](../.bava/attachments/s.png)](https://example.com)\n',
      '![x](../.bava/attachments/s.png)\r\n',
    ]) {
      expect(unusedNames(one('s.png'), text), text).toEqual([]);
    }
  });

  it('is used whatever its encoding, case or accents', () => {
    expect(unusedNames(one('my (1) file.png'), '![x](../.bava/attachments/my%20%281%29%20file.png)\n')).toEqual([]);
    expect(unusedNames(one('logo.png'), '![x](../.bava/attachments/Logo.PNG)\n')).toEqual([]);
    // The same accented name, written composed in the page and decomposed on disk.
    expect(unusedNames(one('cafe\u0301.png'), '![x](../.bava/attachments/caf\u00e9.png)\n')).toEqual([]);
  });

  it('is unused only when no page names it at all', () => {
    expect(unusedNames(one('s.png'), 'Nothing here.\n')).toEqual(['s.png']);
  });
});

describe('what is known of use', () => {
  const file = [{ name: 's.png', size: 1, modified: '2026-09-01T00:00:00Z' }];

  it('is nothing while the pages are not read: no file is called unused', () => {
    const usage = mediaUsage(file, null);
    expect(usage.known).toBe(false);
    expect(usage.items[0].unused).toBe(false);
  });

  it('is not enough when a page could not be read: no file is called unused', () => {
    const usage = mediaUsage(file, [{ name: 'P', path: 'P.md', text: '', unreadable: true }]);
    expect(usage.known).toBe(false);
    expect(usage.items[0].unused).toBe(false);
  });

  it('is enough when every page was read', () => {
    const usage = mediaUsage(file, [{ name: 'P', path: 'P.md', text: 'Nothing.\n' }]);
    expect(usage.known).toBe(true);
    expect(usage.items[0].unused).toBe(true);
  });
});
