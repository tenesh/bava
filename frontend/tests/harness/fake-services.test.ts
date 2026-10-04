import { describe, expect, it } from 'vitest';
import * as real from '../../bindings/github.com/tenesh/bava/internal/app';
import { createFakes } from './fake-services';
import { seedSpace } from '../fixtures/space';

// The browser tests run the app against these fakes. A binding the app can
// call with no fake behind it would fail at a screen, far from its cause.
describe('the stand-in Go side', () => {
  const fakes = createFakes(seedSpace());
  const services = ['ExportService', 'FileService', 'LogService', 'MenuService', 'RenderService', 'SpaceService'] as const;

  it.each(services)('%s has a fake for every bound method', (service) => {
    const methods = Object.keys(real[service]).filter((name) => typeof (real[service] as Record<string, unknown>)[name] === 'function');
    expect(methods.length).toBeGreaterThan(0);
    for (const method of methods) {
      expect(typeof (fakes[service] as Record<string, unknown>)[method], `${service}.${method}`).toBe('function');
    }
  });

  it('opens the seeded Space and lists it in its order', async () => {
    const info = await fakes.SpaceService.Open('/Users/you/Documents/Acme Product');
    expect(info.error).toBe('');
    const list = await fakes.SpaceService.List(info.root, '');
    expect(list.entries?.map((e) => e.name)).toEqual(['Marketing', 'Engineering', 'Roadmap.md', 'Team handbook.md']);
  });

  it('refuses as Go does, with Go\'s codes', async () => {
    const root = '/Users/you/Documents/Acme Product';
    const op = { path: '', folder: '', name: '', index: -1, id: '', width: '' };
    expect((await fakes.SpaceService.Apply(root, { ...op, kind: 'createPage', name: 'Roadmap' })).code).toBe('exists');
    expect((await fakes.SpaceService.Apply(root, { ...op, kind: 'createPage', name: '  ' })).code).toBe('nameEmpty');
    expect((await fakes.SpaceService.Apply(root, { ...op, kind: 'createPage', name: 'a/b' })).code).toBe('nameSlash');
    expect((await fakes.SpaceService.Open('/nowhere')).code).toBe('notSpace');
  });

  it('renames a Media file keeping its type, and refuses a name another file has', async () => {
    const f = createFakes(seedSpace());
    const root = '/Users/you/Documents/Acme Product';
    const op = { path: '', folder: '', index: -1, id: '', width: '', kind: 'renameAttachment' };
    expect((await f.SpaceService.Apply(root, { ...op, attachment: 'logo.png', name: 'landscape' })).code).toBe('exists');
    const renamed = await f.SpaceService.Apply(root, { ...op, attachment: 'logo.png', name: 'mark' });
    expect(renamed).toMatchObject({ name: 'mark.png', error: '' });
  });

  it('answers code with a map left open as D2 does: a diagnostic on its line, and nothing drawn', async () => {
    const result = await fakes.RenderService.Render('a -> b\nb: {\n', {});
    expect(result.svg).toBe('');
    expect(result.errors).toEqual([{ message: 'maps must be terminated with }', from: 10, to: 12, line: 2 }]);
  });

  it('makes a page that the next listing shows, and opens it', async () => {
    const f = createFakes(seedSpace());
    const root = '/Users/you/Documents/Acme Product';
    const made = await f.SpaceService.Apply(root, { path: '', folder: 'Marketing', name: 'Budget', index: -1, id: '', width: '', kind: 'createPage' });
    expect(made.path).toBe('Marketing/Budget.md');
    const list = await f.SpaceService.List(root, 'Marketing');
    expect(list.entries?.some((e) => e.path === 'Marketing/Budget.md')).toBe(true);
    const opened = await f.FileService.Open(`${root}/Marketing/Budget.md`);
    expect(opened.error).toBe('');
  });

  it('moves an item to the Trash and lists it there', async () => {
    const f = createFakes(seedSpace());
    const root = '/Users/you/Documents/Acme Product';
    await f.SpaceService.Apply(root, { path: 'Roadmap.md', folder: '', name: '', index: -1, id: '', width: '', kind: 'trash' });
    const trash = await f.SpaceService.Trash(root);
    expect(trash.items?.map((i) => i.path)).toContain('Roadmap.md');
  });
});

describe('what the app checks need from the stand-in', () => {
  const root = '/Users/you/Documents/Acme Product';

  it('fails as a walk asks: a change on disk, a save, a setting', async () => {
    const f = createFakes(seedSpace());
    Object.assign(f.harness.faults, { changedOnDisk: true, saveFails: true, settingsSaveFails: true });
    expect(await f.FileService.ChangedOnDisk(`${root}/Roadmap.md`, null)).toBe(true);
    await expect(f.FileService.Save(`${root}/Roadmap.md`, '', { version: 1, elements: [] })).rejects.toThrow();
    expect(await f.FileService.SaveSettings(await f.FileService.Settings())).not.toBe('');
  });

  it('opens the page kept in no Space, once Open File is to answer it', async () => {
    const f = createFakes(seedSpace());
    expect((await f.FileService.ChooseFileToOpen()).path).toBe('');
    f.harness.fileToOpen = '/Users/you/Documents/Notes.md';
    const chosen = await f.FileService.ChooseFileToOpen();
    expect((await f.FileService.Open(chosen.path)).source).toContain('# Notes');
  });
});

describe('what the Document checks need from the stand-in', () => {
  it('puts words into a page, which then opens with them', async () => {
    const root = '/Users/you/Documents/Acme Product';
    const fakes = createFakes(seedSpace());
    fakes.harness.setSource(root, 'Marketing/Press release.md', '# Press\n');
    const opened = await fakes.FileService.Open(`${root}/Marketing/Press release.md`);
    expect(opened.source).toBe('# Press\n');
  });
});

describe('what the canvas checks need from the stand-in', () => {
  const root = '/Users/you/Documents/Acme Product';

  it('puts a scene into a page, which then opens with it', async () => {
    const fakes = createFakes(seedSpace());
    fakes.harness.setScene(root, 'Roadmap.md', { version: 1, elements: [{ id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 }] });
    const opened = await fakes.FileService.Open(`${root}/Roadmap.md`);
    expect(opened.scene.elements).toHaveLength(1);
    // The page's words stay as they were.
    expect(opened.source).toContain('# Roadmap');
  });

  it('reads back the scene a save wrote', async () => {
    const fakes = createFakes(seedSpace());
    await fakes.FileService.Save(`${root}/Roadmap.md`, '# Roadmap\n', { version: 1, elements: [{ id: 'b', type: 'ellipse', x: 1, y: 2, w: 3, h: 4, z: 1 }] });
    expect(fakes.harness.scene(root, 'Roadmap.md')?.elements).toEqual([{ id: 'b', type: 'ellipse', x: 1, y: 2, w: 3, h: 4, z: 1 }]);
  });

  it('keeps every export, with where it went and its bytes', async () => {
    const fakes = createFakes(seedSpace());
    await fakes.ExportService.Save('/Users/you/Documents/a.svg', btoa('<svg/>'));
    expect(fakes.harness.exports).toEqual([{ path: '/Users/you/Documents/a.svg', contentsBase64: btoa('<svg/>') }]);
  });
});
