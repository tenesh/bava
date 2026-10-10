import { describe, expect, it } from 'vitest';
import { fakeZipPlan } from './fake-zip';
import { seedSpace } from '../fixtures/space';

// The same rules as Go's `internal/space/zip_test.go`, over the seeded Space.
describe('fakeZipPlan', () => {
  it('holds every page, attachment and template of a Space, and its settings, never the Trash', () => {
    const plan = fakeZipPlan(seedSpace(), { kind: 'space', path: '', attachments: null });
    if (!Array.isArray(plan)) throw new Error(plan.error);
    const paths = plan.map((f) => f.path);
    expect(paths).toContain('Marketing/Launch plan.md');
    expect(paths).toContain('.bava/attachments/logo.png');
    expect(paths).toContain('.bava/templates/Bug report.md');
    expect(paths).toContain('.bava/space.json');
    expect(paths.some((p) => p.includes('trash') || p.includes('Q3 retro'))).toBe(false);
  });

  it("keeps a folder's pages at their place, with only the attachments named", () => {
    const plan = fakeZipPlan(seedSpace(), { kind: 'folder', path: 'Marketing', attachments: ['logo.png'] });
    if (!Array.isArray(plan)) throw new Error(plan.error);
    expect(plan.map((f) => f.path)).toEqual(['.bava/attachments/logo.png', 'Marketing/Brand guide.md', 'Marketing/Launch plan.md', 'Marketing/Press release.md']);
  });

  it('refuses an attachment that is not there', () => {
    expect(fakeZipPlan(seedSpace(), { kind: 'page', path: 'Roadmap.md', attachments: ['nope.png'] })).toMatchObject({ code: 'notAttachment' });
    expect(fakeZipPlan(seedSpace(), { kind: 'page', path: 'Marketing', attachments: [] })).toMatchObject({ code: 'notPage' });
  });
});
