import { describe, expect, it } from 'vitest';
import { zipPreview } from './zip-preview';

const files = [
  { path: '.bava/attachments/logo.png', size: 1000 },
  { path: '.bava/attachments/notes.pdf', size: 2000 },
  { path: '.bava/space.json', size: 50 },
  { path: '.bava/templates/Meetings/Weekly sync.md', size: 30 },
  { path: 'Marketing/Launch plan.md', size: 300 },
  { path: 'Marketing/Old/Brief.md', size: 100 },
  { path: 'Marketing/notes.txt', size: 20 },
  { path: 'Roadmap.md', size: 200 },
];

describe('the zip preview', () => {
  it('shows the folders and files as a tree, pages by name without .md', () => {
    expect(zipPreview(files).rows).toEqual([
      { name: 'Marketing', depth: 0, kind: 'folder' },
      { name: 'Old', depth: 1, kind: 'folder' },
      { name: 'Brief', depth: 2, kind: 'page' },
      { name: 'Launch plan', depth: 1, kind: 'page' },
      { name: 'notes.txt', depth: 1, kind: 'file' },
      { name: 'Roadmap', depth: 0, kind: 'page' },
    ]);
  });

  it("counts the hidden folder's parts, and the pages, files and size", () => {
    const preview = zipPreview(files);
    expect(preview.hidden).toEqual({ attachments: 2, templates: 1, settings: true });
    expect(preview.pages).toBe(3);
    expect(preview.files).toBe(8);
    expect(preview.bytes).toBe(3700);
  });
});
