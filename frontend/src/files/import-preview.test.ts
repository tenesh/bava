import { describe, expect, it } from 'vitest';
import { importPreview, importSummary } from './import-preview';
import type { ImportPlan } from './space.svelte';

const plan = (into: string, entries: ImportPlan['entries'], extra: Partial<ImportPlan> = {}): ImportPlan =>
  ({ into, origins: [], entries, renames: [], pages: 0, files: 0, templates: 0, bytes: 0, ...extra }) as ImportPlan;
const entry = (kind: string, from: string, to: string, size = 1, origin = 0) => ({ kind, origin, from, entry: '', to, size });

describe('what an import shows it will bring', () => {
  it('draws a folder as it lands, its files beside its pages', () => {
    const files = importPreview(
      plan('Marketing', [
        entry('folder', 'Q4 notes', 'Marketing/Q4 notes 2', 0),
        entry('folder', 'Q4 notes/Press', 'Marketing/Q4 notes 2/Press', 0),
        entry('page', 'Q4 notes/Press/Media kit.md', 'Marketing/Q4 notes 2/Press/Media kit.md', 5),
        entry('file', 'Q4 notes/Press/logo.png', 'logo.png', 7),
      ]),
    );
    expect(files).toEqual([
      { path: 'Q4 notes 2/Press/Media kit.md', size: 5 },
      { path: 'Q4 notes 2/Press/logo.png', size: 7 },
    ]);
  });

  it("counts a Space's attachments and templates in the hidden folder", () => {
    const files = importPreview(
      plan('', [
        entry('page', 'First page.md', 'First page 2.md'),
        entry('file', '.bava/attachments/logo.png', 'logo.png'),
        entry('template', '.bava/templates/Weekly sync.md', 'Weekly sync 2.md'),
      ]),
    );
    expect(files.map((f) => f.path)).toEqual(['First page 2.md', '.bava/attachments/logo.png', '.bava/templates/Weekly sync 2.md']);
  });

  it('puts a file picked at the top level at the top', () => {
    expect(importPreview(plan('', [entry('file', 'Budget.xlsx', 'Budget.xlsx')])).map((f) => f.path)).toEqual(['Budget.xlsx']);
  });

  it('sums up pages, files and size', () => {
    expect(importSummary(plan('', [], { pages: 8, files: 4, bytes: 2.1 * 1024 * 1024 }))).toBe('8 pages · 4 files · 2.1 MB');
  });
});
