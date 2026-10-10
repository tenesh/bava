import { describe, expect, it } from 'vitest';
import { attachmentsFor, zipName } from './export-zip';

const files = [
  { name: 'logo.png', size: 10, modified: '' },
  { name: 'Funnel.png', size: 20, modified: '' },
  { name: 'unused.pdf', size: 30, modified: '' },
  { name: 'notes.pdf', size: 40, modified: '' },
];
const pages = [
  { name: 'Launch plan', path: 'Marketing/Launch plan.md', text: '![logo](../.bava/attachments/logo.png)\n\n![Funnel](../.bava/attachments/Funnel.png "embed")\n' },
  { name: 'Brand guide', path: 'Marketing/Brand guide.md', text: '![logo](../.bava/attachments/logo.png)\n[notes](../.bava/attachments/notes.pdf)\n' },
  { name: 'Roadmap', path: 'Roadmap.md', text: '# Roadmap\n' },
];

describe('the files a zip carries', () => {
  it("names a page's images, files and embed pictures", () => {
    expect(attachmentsFor(files, pages, ['Marketing/Launch plan.md'])).toEqual(['Funnel.png', 'logo.png']);
  });

  it("names a folder's pages' files together, each once", () => {
    expect(attachmentsFor(files, pages, ['Marketing/Launch plan.md', 'Marketing/Brand guide.md'])).toEqual(['Funnel.png', 'logo.png', 'notes.pdf']);
  });

  it('leaves out a file no page in the zip uses', () => {
    expect(attachmentsFor(files, pages, ['Roadmap.md'])).toEqual([]);
  });
});

describe("a zip's name", () => {
  it("is the page's title, the folder's name, or the Space's", () => {
    expect(zipName('page', 'Marketing/Launch plan.md', 'Acme Product')).toBe('Launch plan.zip');
    expect(zipName('folder', 'Marketing/Old', 'Acme Product')).toBe('Old.zip');
    expect(zipName('space', '', 'Acme Product')).toBe('Acme Product.zip');
  });
});
