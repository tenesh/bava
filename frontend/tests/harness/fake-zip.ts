/**
 * What the stand-in's Markdown zip holds, answering as Go's `Space.ZipPlan`
 * does (`internal/space/zip.go`): a Space's every page, attachment and
 * template with its settings, never the Trash; a folder's or a page's own
 * pages at their place, with the attachments named.
 */
import type { FakeSpace } from '../fixtures/space';

export type FakeZipScope = { kind: 'space' | 'folder' | 'page'; path: string; attachments: string[] | null };
export type FakeZipFile = { path: string; size: number };

const size = (text: string) => new TextEncoder().encode(text).length;

/** The plan, or a refusal with the code Go gives it. */
export function fakeZipPlan(space: FakeSpace, scope: FakeZipScope): FakeZipFile[] | { code: string; error: string } {
  const pages: FakeZipFile[] = [];
  const walk = (folder: string) => {
    for (const name of space.folders[folder] ?? []) {
      const path = folder ? `${folder}/${name}` : name;
      if (path in space.folders) walk(path);
      else pages.push({ path, size: size(space.pages[path]?.source ?? '') });
    }
  };
  const attachment = (name: string): FakeZipFile | { code: string; error: string } => {
    const file = space.attachments.find((a) => a.name === name);
    return file ? { path: `.bava/attachments/${name}`, size: file.size } : { code: 'notAttachment', error: `"${name}" is not an attachment` };
  };
  let files: FakeZipFile[];
  if (scope.kind === 'space') {
    walk('');
    const templates = Object.keys(space.pages)
      .filter((p) => p.startsWith('.bava/templates/'))
      .map((p) => ({ path: p, size: size(space.pages[p].source) }));
    files = [...pages, ...space.attachments.map((a) => ({ path: `.bava/attachments/${a.name}`, size: a.size })), ...templates, { path: '.bava/space.json', size: 64 }];
  } else {
    if (scope.kind === 'folder') {
      if (!(scope.path in space.folders)) return { code: 'notFolder', error: `${scope.path} is not a folder` };
      walk(scope.path);
      files = pages;
    } else {
      if (!(scope.path in space.pages)) return { code: 'notPage', error: `${scope.path} is not a page` };
      files = [{ path: scope.path, size: size(space.pages[scope.path].source) }];
    }
    for (const name of scope.attachments ?? []) {
      const file = attachment(name);
      if (!('path' in file)) return file;
      files.push(file);
    }
  }
  return [...new Map(files.map((f) => [f.path, f])).values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
