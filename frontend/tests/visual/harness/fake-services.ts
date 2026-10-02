/**
 * The Go side, faked for the screen checks: the same services and methods as
 * the generated bindings, answering over an in-memory Space as the real ones
 * answer over a folder, refusals and their codes included. Nothing here
 * touches a disk or the network.
 */
import { PARENT, SPACE_ROOT, seedSpace, type FakePage, type FakeSpace } from './fixtures';
import { linkName } from '../../../src/docs/links';

type Op = { kind: string; path: string; folder: string; name: string; index: number; id: string; width: string; attachment?: string; edits?: { path: string; before: string; after: string }[] };

const PAGE_EXT = '.md';
const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const baseOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const join = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

function refusal(code: string, error: string) {
  return { error, code };
}

/** Checks a typed name as Go's validName does. */
function checkName(name: string): { name: string } | { error: string; code: string } {
  const trimmed = name.trim();
  if (trimmed === '') return refusal('nameEmpty', 'a name is needed');
  if (/[/\\\0]/.test(trimmed)) return refusal('nameSlash', `"${trimmed}": a name cannot hold / or \\`);
  if (trimmed.startsWith('.')) return refusal('nameDot', `"${trimmed}": a name cannot start with a dot`);
  if (/[:*?"<>|]/.test(trimmed) || trimmed.endsWith('.')) return refusal('nameReserved', `"${trimmed}" is not a name Windows allows`);
  return { name: trimmed };
}

export function createFakes(first: FakeSpace = seedSpace()) {
  const spaces = new Map<string, FakeSpace>([[first.root, first]]);
  let settings = {
    debounceMs: 250,
    layoutEngine: 'tala',
    autosave: 'off',
    autosaveDelayMs: 1000,
    verboseLogging: false,
    arrowBinding: true,
    midpointSnap: true,
    objectSnap: false,
  };
  let trashIds = 100;

  const spaceOf = (root: string) => spaces.get(root);
  const isFolder = (space: FakeSpace, path: string) => path in space.folders;
  const exists = (space: FakeSpace, path: string) => isFolder(space, path) || path in space.pages;
  const ok = (extra: Record<string, string | string[]> = {}) => ({ path: '', id: '', root: '', error: '', code: '', ...extra });

  function remove(space: FakeSpace, path: string) {
    const folder = parentOf(path);
    space.folders[folder] = (space.folders[folder] ?? []).filter((name) => name !== baseOf(path));
  }

  function insert(space: FakeSpace, folder: string, name: string, index = -1) {
    const list = [...(space.folders[folder] ?? [])];
    if (index < 0 || index > list.length) list.push(name);
    else list.splice(index, 0, name);
    space.folders[folder] = list;
  }

  /** Moves a page or folder, and everything under a folder, to a new path. */
  function relocate(space: FakeSpace, from: string, to: string) {
    for (const key of Object.keys(space.pages)) {
      if (key === from || key.startsWith(from + '/')) {
        space.pages[to + key.slice(from.length)] = space.pages[key];
        delete space.pages[key];
      }
    }
    for (const key of Object.keys(space.folders)) {
      if (key === from || key.startsWith(from + '/')) {
        space.folders[to + key.slice(from.length)] = space.folders[key];
        delete space.folders[key];
      }
    }
  }

  function numbered(space: FakeSpace, folder: string, stem: string, ext: string) {
    for (let n = 2; ; n += 1) {
      const name = `${stem} ${n}${ext}`;
      if (!exists(space, join(folder, name))) return name;
    }
  }

  function apply(space: FakeSpace, op: Op) {
    switch (op.kind) {
      case 'createPage':
      case 'createFolder': {
        const checked = checkName(op.name);
        if ('code' in checked) return ok(checked);
        const name = op.kind === 'createPage' ? checked.name + PAGE_EXT : checked.name;
        const path = join(op.folder, name);
        if (exists(space, path)) return ok(refusal('exists', `"${name}" already exists`));
        insert(space, op.folder, name);
        if (op.kind === 'createPage') space.pages[path] = { source: '', scene: { version: 1, elements: [] } };
        else space.folders[path] = [];
        return ok({ path });
      }
      case 'rename': {
        const checked = checkName(op.name);
        if ('code' in checked) return ok(checked);
        const page = op.path.endsWith(PAGE_EXT);
        const name = page ? checked.name + PAGE_EXT : checked.name;
        const to = join(parentOf(op.path), name);
        if (to !== op.path && exists(space, to)) return ok(refusal('exists', `"${name}" already exists`));
        const folder = parentOf(op.path);
        space.folders[folder] = (space.folders[folder] ?? []).map((entry) => (entry === baseOf(op.path) ? name : entry));
        relocate(space, op.path, to);
        return ok({ path: to });
      }
      case 'move': {
        if (op.folder === op.path || op.folder.startsWith(op.path + '/')) return ok(refusal('intoItself', 'a folder cannot go inside itself'));
        const to = join(op.folder, baseOf(op.path));
        if (to !== op.path && exists(space, to)) return ok(refusal('exists', `"${baseOf(op.path)}" already exists`));
        remove(space, op.path);
        insert(space, op.folder, baseOf(op.path), op.index);
        relocate(space, op.path, to);
        return ok({ path: to });
      }
      case 'duplicate': {
        if (!(op.path in space.pages)) return ok(refusal('onlyPage', 'only a page can be duplicated'));
        const folder = parentOf(op.path);
        const name = numbered(space, folder, baseOf(op.path).slice(0, -PAGE_EXT.length), PAGE_EXT);
        const path = join(folder, name);
        insert(space, folder, name);
        space.pages[path] = structuredClone(space.pages[op.path]);
        return ok({ path });
      }
      case 'trash': {
        if (!exists(space, op.path)) return ok(refusal('outside', `"${op.path}" is not in the Space`));
        const id = `t${(trashIds += 1)}`;
        remove(space, op.path);
        relocate(space, op.path, `\u0000trash/${id}/${op.path}`);
        space.trash.unshift({ id, path: op.path, kind: isFolder(space, `\u0000trash/${id}/${op.path}`) ? 'folder' : 'page', deletedAt: '2026-09-27T12:00:00Z', size: 1024 });
        return ok({ id, path: op.path });
      }
      case 'trashAttachment': {
        const at = space.attachments.findIndex((file) => file.name === op.attachment);
        if (at < 0) return ok({ error: `"${op.attachment}" is not an attachment` });
        const [file] = space.attachments.splice(at, 1);
        const id = `t${(trashIds += 1)}`;
        space.trash.unshift({ id, path: `.bava/attachments/${file.name}`, kind: 'attachment', deletedAt: '2026-09-27T12:00:00Z', size: file.size });
        return ok({ id, path: `.bava/attachments/${file.name}` });
      }
      case 'restore': {
        const item = space.trash.find((entry) => entry.id === op.id);
        if (!item) return ok(refusal('', `"${op.id}" is not in the Trash`));
        if (item.kind === 'attachment') {
          space.trash = space.trash.filter((entry) => entry.id !== item.id);
          space.attachments.push({ name: baseOf(item.path), size: item.size, modified: '2026-09-27T12:00:00Z' });
          return ok({ path: item.path });
        }
        const folder = parentOf(item.path);
        let name = baseOf(item.path);
        if (exists(space, item.path)) {
          const ext = item.kind === 'page' ? PAGE_EXT : '';
          name = numbered(space, folder, ext ? name.slice(0, -ext.length) : name, ext);
        }
        for (let at = folder; at && !isFolder(space, at); at = parentOf(at)) {
          space.folders[at] = [];
          insert(space, parentOf(at), baseOf(at));
        }
        insert(space, folder, name);
        relocate(space, `\u0000trash/${item.id}/${item.path}`, join(folder, name));
        if (item.kind === 'page' && !(join(folder, name) in space.pages)) space.pages[join(folder, name)] = { source: '', scene: { version: 1, elements: [] } };
        if (item.kind === 'folder' && !isFolder(space, join(folder, name))) space.folders[join(folder, name)] = [];
        space.trash = space.trash.filter((entry) => entry.id !== op.id);
        return ok({ path: join(folder, name) });
      }
      case 'deleteForever':
        space.trash = space.trash.filter((entry) => entry.id !== op.id);
        return ok();
      case 'emptyTrash':
        space.trash = [];
        return ok();
      case 'renameSpace': {
        const checked = checkName(op.name);
        if ('code' in checked) return ok(checked);
        const root = join(parentOf(space.root), checked.name);
        if (spaces.has(root)) return ok(refusal('exists', `"${checked.name}" already exists`));
        spaces.delete(space.root);
        space.root = root;
        spaces.set(root, space);
        return ok({ root });
      }
      case 'setPageWidth':
        space.pageWidth = op.width;
        return ok();
      case 'relink': {
        const missed: string[] = [];
        for (const edit of op.edits ?? []) {
          const page = space.pages[edit.path];
          if (page && page.source === edit.before) page.source = edit.after;
          else missed.push(edit.path);
        }
        return ok({ missed });
      }
      default:
        return ok(refusal('', `unknown operation "${op.kind}"`));
    }
  }

  // What the walks reach past the app: scenes put into pages before they
  // open, scenes read back after a save, and every export kept.
  const exports: { path: string; contentsBase64: string }[] = [];
  const harness = {
    exports,
    setScene(root: string, path: string, scene: FakePage['scene']) {
      const space = spaceOf(root);
      if (!space || !(path in space.pages)) throw new Error(`no page ${path}`);
      space.pages[path] = { ...space.pages[path], scene: structuredClone(scene) };
    },
    scene(root: string, path: string): FakePage['scene'] | undefined {
      const scene = spaceOf(root)?.pages[path]?.scene;
      return scene ? structuredClone(scene) : undefined;
    },
  };

  function pageAt(absolute: string) {
    for (const space of spaces.values()) {
      if (absolute.startsWith(space.root + '/')) {
        const rel = absolute.slice(space.root.length + 1);
        if (rel in space.pages) return { space, rel };
      }
    }
    return null;
  }

  const stamp = { size: 0, modifiedUnixNano: '0' as `${number}` };
  const info = (space: FakeSpace) => ({ root: space.root, name: baseOf(space.root), pageWidth: space.pageWidth, error: '', code: '' });

  return {
    harness,
    SpaceService: {
      async Open(dir: string) {
        const space = spaceOf(dir);
        return space ? info(space) : { root: '', name: '', pageWidth: '', ...refusal('notSpace', `${baseOf(dir)} is not a Space`) };
      },
      async Create(parent: string, name: string) {
        const checked = checkName(name);
        if ('code' in checked) return { root: '', name: '', pageWidth: '', ...checked };
        const root = join(parent, checked.name);
        if (spaces.has(root)) return { root: '', name: '', pageWidth: '', ...refusal('exists', `"${checked.name}" already exists`) };
        const space: FakeSpace = { root, pageWidth: '', folders: { '': [] }, pages: {}, trash: [], attachments: [] };
        spaces.set(root, space);
        return info(space);
      },
      async List(root: string, folder: string) {
        const space = spaceOf(root);
        if (!space) return { entries: null, ...refusal('notSpace', 'not a Space') };
        if (!isFolder(space, folder)) return { entries: null, error: `list ${folder}: no such folder`, code: '' };
        const entries = space.folders[folder].map((name) => {
          const path = join(folder, name);
          return { name, path, kind: isFolder(space, path) ? 'folder' : 'page' };
        });
        return { entries, error: '', code: '' };
      },
      async Apply(root: string, op: Op) {
        const space = spaceOf(root);
        return space ? apply(space, op) : ok(refusal('notSpace', 'not a Space'));
      },
      async Index(root: string, withText: boolean) {
        const space = spaceOf(root);
        if (!space) return { pages: null, ...refusal('notSpace', 'not a Space') };
        // Every page in the tree's order, with its text when asked.
        const pages: { name: string; path: string; text: string }[] = [];
        const walk = (folder: string) => {
          for (const name of space.folders[folder] ?? []) {
            const path = join(folder, name);
            if (isFolder(space, path)) walk(path);
            else pages.push({ name: linkName(path), path, text: withText ? space.pages[path].source : '' });
          }
        };
        walk('');
        return { pages, error: '', code: '' };
      },
      async Trash(root: string) {
        const space = spaceOf(root);
        if (!space) return { items: null, size: 0, ...refusal('notSpace', 'not a Space') };
        return { items: space.trash, size: space.trash.reduce((sum, item) => sum + item.size, 0), error: '', code: '' };
      },
      async ChooseFolder(_title: string) {
        return { path: SPACE_ROOT, error: '' };
      },
      async Reveal(_root: string, _path: string) {
        return { error: '', code: '' };
      },
      async Attachments(_root: string) {
        return { attachments: structuredClone(spaceOf(_root)?.attachments ?? []), error: '' };
      },
      async FetchCard(_root: string, _address: string) {
        return { title: '', description: '', icon: '', image: '', error: 'offline' };
      },
    },
    FileService: {
      async Open(path: string) {
        const found = pageAt(path);
        if (!found) return { path, source: '', diagrams: null, scene: { version: 1, elements: [] }, stamp, error: `open ${path}: no such file` };
        const page = found.space.pages[found.rel];
        return { path, source: page.source, diagrams: null, scene: structuredClone(page.scene), stamp, error: '' };
      },
      async Save(path: string, source: string, scene: FakeSpace['pages'][string]['scene']) {
        const found = pageAt(path);
        if (found) found.space.pages[found.rel] = { source, scene: structuredClone(scene) };
        return { path, stamp, error: '' };
      },
      async ChangedOnDisk(_path: string, _stamp: unknown) {
        return false;
      },
      async ChooseFileToOpen() {
        return { path: '', error: '' };
      },
      async ChooseFileToSave(suggestedName: string) {
        return { path: `${PARENT}/${suggestedName}`, error: '' };
      },
      async ChooseMedia(_kind: string) {
        return { paths: [], error: '' };
      },
      async ClipboardImage() {
        return '';
      },
      async FileDetails(_root: string, path: string) {
        // The pretend Space's files: the one card fixture that is there.
        const there = path === '.bava/attachments/Q3 report.pdf';
        return { exists: there, size: there ? 248_000 : 0, modified: there ? '2026-09-21T09:00:00Z' : '', error: '' };
      },
      async OpenFile(_root: string, _path: string) {
        return '';
      },
      async Settings() {
        return { ...settings };
      },
      async SaveSettings(next: typeof settings) {
        settings = { ...next };
        return '';
      },
    },
    RenderService: {
      async Render(source: string, _opts: unknown) {
        // The dialog's starting code lays out as nothing, so it opens with
        // Insert off as pictured; anything typed lays out as the one box.
        const typed = source.trim() !== 'a -> b';
        return {
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect x="10" y="10" width="100" height="50" rx="4" fill="#fff" stroke="#8b8b83"/><text x="60" y="40" text-anchor="middle" font-size="13">api</text></svg>',
          errors: [],
          nodeMap: {},
          layout: { shapes: typed ? [{ id: 'api', type: 'rectangle', x: 10, y: 10, w: 100, h: 50, label: 'api' }] : [], connections: [] },
        };
      },
    },
    ExportService: {
      async Save(path: string, contentsBase64: string) {
        exports.push({ path, contentsBase64 });
        return '';
      },
    },
    MenuService: {
      async SetState(_state: unknown) {},
    },
    LogService: {
      async Report(_entry: unknown) {},
      async TakeNotices() {
        return [];
      },
      async Diagnostics(_userAgent: string) {
        return '';
      },
      async OpenLogsFolder() {
        return '';
      },
      async SetVerbose(_on: boolean) {
        return '';
      },
    },
  };
}

export type Fakes = ReturnType<typeof createFakes>;
