import { describe, expect, it } from 'vitest';
import * as real from '../../../bindings/github.com/tenesh/bava/internal/app';
import { createFakes } from './fake-services';
import { seedSpace } from './fixtures';

// The screen checks run the app against these fakes. A binding the app can
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
