/**
 * The Go side, faked for the browser tests: the same services and methods as
 * the generated bindings, answering over an in-memory Space as the real ones
 * answer over a folder, refusals and their codes included. Nothing here
 * touches a disk or the network.
 */
import { PARENT, SPACE_ROOT, seedSpace, type FakePage, type FakeSpace } from '../fixtures/space';
import { linkName } from '../../src/docs/links';
import { fakeSearch, type FakeOpenPage } from './fake-search';
import { fakeZipPlan, type FakeZipScope } from './fake-zip';

type Op = {
  kind: string;
  path: string;
  folder: string;
  name: string;
  index: number;
  id: string;
  width: string;
  attachment?: string;
  edits?: { path: string; before: string; after: string }[];
  data?: string;
  replace?: boolean;
};

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

/**
 * How the Go side starts, set by a walk before the page loads
 * (`window.__bavaBoot`): what launch reads before anything is on screen.
 */
export type Boot = {
  /** The settings never answer, so the splash stays over the window. */
  holdSettings?: boolean;
  /** The call for the settings fails on its way to Go (Go itself falls back to the defaults). */
  failSettings?: boolean;
  /** Settings saved before this launch, over the defaults. */
  settings?: Record<string, unknown>;
  /** What Go tells the page once at launch: the last session ended unexpectedly, or the window was reloaded. */
  notices?: { kind: string; session: string }[];
  /** Folders a store's sandbox no longer lets Bava reach at launch. */
  lost?: string[];
};

const boot = (): Boot => (globalThis as { __bavaBoot?: Boot }).__bavaBoot ?? {};

/** The ways the Go side can fail while the app runs, switched on by a walk. */
export type Faults = {
  /** Another program wrote the open page since it was read. */
  changedOnDisk: boolean;
  /** A save's call fails on its way to Go. */
  saveFails: boolean;
  /** Settings cannot be written. */
  settingsSaveFails: boolean;
  /** A folder listed with rows the Files pane cannot draw: its folders' names cannot be written out. */
  undrawable: string | null;
  /** A page, by its path in the Space, that cannot be opened. */
  unreadable: string | null;
  /** How long each page takes to open, in milliseconds. */
  slowOpen: number;
  /** A page, by its path in the Space, the system's printing fails on. */
  unprintable: string | null;
  /** How long each item of an import takes, in milliseconds: time to cancel it. */
  slowImport: number;
  /** How long each file of a zip takes to write, in milliseconds. */
  slowZip: number;
  /** How long a Space's PDF takes to print, in milliseconds. */
  slowPrint: number;
};

type FakeImportEntry = { kind: string; origin: number; from: string; entry: string; to: string; size: number };
type FakeImportPlan = {
  into: string;
  origins: { path: string; root: string }[];
  entries: FakeImportEntry[];
  renames: { from: string; to: string }[];
  skipped: string[];
  pages: number;
  files: number;
  templates: number;
  bytes: number;
};
const emptyImport = (): FakeImportPlan => ({ into: '', origins: [], entries: [], renames: [], skipped: [], pages: 0, files: 0, templates: 0, bytes: 0 });

/** A step of a long task, as Go sends it to the window. */
function sendProgress(task: string, done: number, total: number) {
  const wails = (globalThis as { _wails?: { dispatchWailsEvent(event: { name: string; data: unknown }): void } })._wails;
  wails?.dispatchWailsEvent({ name: 'progress', data: { task, done, total } });
}

/** The one D2 complaint the stand-in knows: a map opened and never closed, as D2 words it. */
function d2Errors(source: string) {
  const opened = (source.match(/{/g) ?? []).length;
  const closed = (source.match(/}/g) ?? []).length;
  if (opened <= closed) return [];
  const from = source.lastIndexOf('{');
  return [{ message: 'maps must be terminated with }', from, to: source.length, line: source.slice(0, from).split('\n').length }];
}

export function createFakes(first: FakeSpace = seedSpace()) {
  const spaces = new Map<string, FakeSpace>([[first.root, first]]);
  const faults: Faults = { changedOnDisk: false, saveFails: false, settingsSaveFails: false, undrawable: null, unreadable: null, slowOpen: 0, unprintable: null, slowImport: 0, slowZip: 0, slowPrint: 0 };
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
  let settingsRead = false;
  /** Each canvas embed's picture saved, in base64, by its name. */
  const pictures = new Map<string, string>();
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
    const TEMPLATES = '.bava/templates/';
    const templateAt = (group: string, name: string) => `${TEMPLATES}${group ? `${group}/` : ''}${name}${PAGE_EXT}`;
    switch (op.kind) {
      // Templates, kept with the pages under their own paths so they open and save as pages do.
      case 'renameTemplate':
      case 'moveTemplate': {
        const page = space.pages[op.path];
        if (!op.path.startsWith(TEMPLATES) || !page) return ok(refusal('outside', 'not a template'));
        const parts = op.path.slice(TEMPLATES.length).split('/');
        const name = op.kind === 'renameTemplate' ? op.name.trim() : parts[parts.length - 1].replace(/\.md$/, '');
        const group = op.kind === 'moveTemplate' ? op.folder.trim() : parts.length === 2 ? parts[0] : '';
        const to = templateAt(group, name);
        if (to !== op.path && space.pages[to]) return ok(refusal('exists', `"${name}" already exists`));
        delete space.pages[op.path];
        space.pages[to] = page;
        return ok({ path: to });
      }
      case 'duplicateTemplate': {
        const page = space.pages[op.path];
        if (!op.path.startsWith(TEMPLATES) || !page) return ok(refusal('outside', 'not a template'));
        const base = op.path.replace(/\.md$/, '');
        let to = `${base} 2${PAGE_EXT}`;
        for (let n = 3; space.pages[to]; n += 1) to = `${base} ${n}${PAGE_EXT}`;
        space.pages[to] = structuredClone(page);
        return ok({ path: to });
      }
      case 'deleteTemplate': {
        if (!op.path.startsWith(TEMPLATES) || !space.pages[op.path]) return ok(refusal('outside', 'not a template'));
        delete space.pages[op.path];
        return ok();
      }
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
      // A canvas embed's picture, as Go saves it: the first under a free name,
      // never shared; a redraw in place.
      case 'savePicture': {
        const checked = checkName(op.name);
        if ('code' in checked) return ok(checked);
        let name = checked.name;
        const taken = (each: string) => space.attachments.some((entry) => entry.name === each);
        if (!op.replace && taken(name)) {
          const dot = name.lastIndexOf('.');
          const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
          for (let n = 2; taken(name); n += 1) name = `${base} ${n}${ext}`;
        }
        const size = Math.floor(((op.data ?? '').length * 3) / 4);
        const entry = space.attachments.find((each) => each.name === name);
        if (entry) entry.size = size;
        else space.attachments.push({ name, size, modified: '2026-10-04T12:00:00Z' });
        pictures.set(name, op.data ?? '');
        return ok({ name });
      }
      case 'renameAttachment': {
        const file = space.attachments.find((entry) => entry.name === op.attachment);
        if (!file) return ok({ error: `"${op.attachment}" is not an attachment` });
        const checked = checkName(op.name);
        if ('code' in checked) return ok(checked);
        const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
        const name = checked.name.toLowerCase().endsWith(ext.toLowerCase()) ? checked.name : checked.name + ext;
        if (name !== file.name && space.attachments.some((entry) => entry.name === name)) return ok(refusal('exists', `"${name}" already exists`));
        file.name = name;
        return ok({ name });
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
      // The Space's .bava gone: its attachments and Trash; the pages stay.
      case 'deleteSpaceData':
        space.trash = [];
        space.attachments = [];
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

  // What the walks reach past the app: words and scenes put into pages
  // before they open, scenes read back after a save, and every export kept.
  const exports: { path: string; contentsBase64: string }[] = [];
  // The Markdown zips written: where, and what each held.
  const zips: { out: string; scope: FakeZipScope; files: string[] }[] = [];
  /** The runs under way, by name: Cancel stops one, as Go does. */
  const stops = new Map<string, () => void>();
  // The PDFs asked for: of which folder, where, and what was sent to print.
  const pdfs: { root: string; out: string; request: { document: unknown; canvas: unknown; setup: unknown; dark: boolean; numbers: boolean } }[] = [];
  // A page on its own, in no Space, and what Open File's picker answers.
  const loose: Record<string, FakePage> = {
    [`${PARENT}/Notes.md`]: { source: '# Notes\n\nA page kept on its own, in no Space.\n', scene: { version: 1, elements: [] } },
    [`${PARENT}/Photos.md`]: { source: '# Photos\n\n![logo](logo.png)\n', scene: { version: 1, elements: [] } },
  };
  // The Space and folder PDFs asked for.
  const spacePdfs: { root: string; out: string; request: { title: string; entries: { title: string; path: string; folder: boolean; document: unknown; canvas: unknown }[] } }[] = [];
  /**
   * Files on the user's disk, outside any Space, by absolute path: what an
   * import reads. A folder of notes, a page beside it, and its picture.
   */
  const disk: Record<string, string> = {
    [`${PARENT}/Q4 notes/Goals.md`]: '# Goals\n\n![chart](chart.png)\n',
    [`${PARENT}/Q4 notes/chart.png`]: 'png',
    [`${PARENT}/Q4 notes/Press/Media kit.md`]: '# Media kit\n\nSee [the goals](../Goals.md).\n',
    [`${PARENT}/Q4 notes/.git/config`]: '[core]\n',
    // A folder with names a Space cannot hold: they stay behind, listed.
    [`${PARENT}/Old notes/Ideas.md`]: '# Ideas\n',
    [`${PARENT}/Old notes/Plan: Q4.md`]: '# Plan\n',
    [`${PARENT}/Old notes/Q3?/Recap.md`]: '# Recap\n',
  };

  /** What importing `sources` into `into` brings, numbered as Go numbers it, or Go's refusal. */
  function planImport(space: FakeSpace, sources: string[], into: string): FakeImportPlan | { error: string; code: string } {
    if (into && !isFolder(space, into)) return refusal('notFolder', `"${into}" is not a folder`);
    const plan: FakeImportPlan = { ...emptyImport(), into };
    const given = new Set<string>();
    const land = (name: string, folder: boolean) => {
      const ext = folder || !name.endsWith(PAGE_EXT) ? '' : PAGE_EXT;
      const base = name.slice(0, name.length - ext.length);
      let got = name;
      for (let n = 2; exists(space, join(into, got)) || given.has(got); n += 1) got = `${base} ${n}${ext}`;
      given.add(got);
      if (got !== name) plan.renames.push({ from: base, to: got.slice(0, got.length - ext.length) });
      return got;
    };
    for (const [origin, source] of sources.entries()) {
      const name = baseOf(source);
      plan.origins.push({ path: source, root: parentOf(source) });
      if (source.endsWith(PAGE_EXT) && source in disk) {
        plan.entries.push({ kind: 'page', origin, from: name, entry: '', to: join(into, land(name, false)), size: disk[source].length });
        continue;
      }
      const inside = Object.keys(disk).filter((path) => path.startsWith(`${source}/`)).sort();
      if (inside.length === 0) return refusal('notImport', `${name} is not a page, a folder or a zip`);
      const top = join(into, land(name, true));
      plan.entries.push({ kind: 'folder', origin, from: name, entry: '', to: top, size: 0 });
      const folders = new Set<string>();
      for (const path of inside) {
        const parts = path.slice(source.length + 1).split('/');
        if (parts.some((part) => part.startsWith('.'))) continue;
        // A name a Space cannot hold stays behind, as Go leaves it: listed once.
        const bad = parts.findIndex((part) => /[:*?"<>|\\]|\.$|^\s|\s$/.test(part));
        if (bad >= 0) {
          const skipped = `${name}/${parts.slice(0, bad + 1).join('/')}`;
          if (!plan.skipped.includes(skipped)) plan.skipped.push(skipped);
          continue;
        }
        for (let i = 1; i < parts.length; i += 1) {
          const rel = parts.slice(0, i).join('/');
          if (folders.has(rel)) continue;
          folders.add(rel);
          plan.entries.push({ kind: 'folder', origin, from: `${name}/${rel}`, entry: '', to: `${top}/${rel}`, size: 0 });
        }
        const rel = parts.join('/');
        const kind = rel.endsWith(PAGE_EXT) ? 'page' : 'file';
        plan.entries.push({ kind, origin, from: `${name}/${rel}`, entry: '', to: kind === 'page' ? `${top}/${rel}` : parts[parts.length - 1], size: disk[path].length });
      }
    }
    plan.pages = plan.entries.filter((e) => e.kind === 'page').length;
    plan.files = plan.entries.filter((e) => e.kind === 'file').length;
    plan.bytes = plan.entries.reduce((sum, e) => sum + e.size, 0);
    return plan;
  }

  const harness = {
    exports,
    /** The system clipboard's text, as the app writes and reads it. */
    clipboard: '',
    /** Files on the user's disk an import reads, by absolute path. */
    disk,
    /** What the import file picker answers. */
    importFiles: [] as string[],
    /** What the folder picker answers when asked for a folder to import; '' answers as for any folder. */
    importFolder: `${PARENT}/Q4 notes`,
    zips,
    pdfs,
    spacePdfs,
    faults,
    /** Paths a store's sandbox no longer lets Bava reach. */
    lost: [...(boot().lost ?? [])] as string[],
    /** Where each folder dialog was asked to open, in order. */
    chosenNear: [] as string[],
    /** Files outside the Space: asked for, chosen, and opened. */
    askedForFiles: [] as string[],
    chosenFiles: [] as string[],
    openedFiles: [] as string[],
    /** The settings as last saved, for a test to read what a control changed. */
    settings: () => ({ ...settings }),
    /** The canvas embeds' pictures saved, in base64, by name. */
    pictures: () => Object.fromEntries(pictures),
    fileToOpen: '',
    setSource(root: string, path: string, source: string) {
      const space = spaceOf(root);
      if (!space || !(path in space.pages)) throw new Error(`no page ${path}`);
      space.pages[path] = { ...space.pages[path], source };
    },
    setScene(root: string, path: string, scene: FakePage['scene']) {
      const space = spaceOf(root);
      if (!space || !(path in space.pages)) throw new Error(`no page ${path}`);
      space.pages[path] = { ...space.pages[path], scene: structuredClone(scene) };
    },
    source(root: string, path: string): string | undefined {
      return spaceOf(root)?.pages[path]?.source;
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
        // A folder whose name throws as its row writes it out: what a pane
        // that fails to draw is shown with.
        if (faults.undrawable === folder) {
          for (const entry of entries) {
            if (entry.kind !== 'folder') continue;
            const name = entry.name;
            (entry as { name: unknown }).name = {
              toString(): string {
                throw new Error(`the row for ${name} cannot be drawn`);
              },
            };
          }
        }
        return { entries, error: '', code: '' };
      },
      async Apply(root: string, op: Op) {
        const space = spaceOf(root);
        return space ? apply(space, op) : ok(refusal('notSpace', 'not a Space'));
      },
      async Templates(root: string) {
        const space = spaceOf(root);
        if (!space) return { templates: [], ...refusal('notSpace', 'not a Space') };
        const templates = Object.keys(space.pages)
          .filter((path) => path.startsWith('.bava/templates/'))
          .map((path) => {
            const parts = path.slice('.bava/templates/'.length).split('/');
            return { group: parts.length === 2 ? parts[0] : '', name: parts[parts.length - 1].replace(/\.md$/, ''), path };
          })
          .sort((a, b) => Number(a.group === '') - Number(b.group === '') || a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
        return { templates, error: '', code: '' };
      },
      async SaveTemplate(root: string, group: string, name: string, source: string, scene: FakePage['scene'], replace: boolean) {
        const space = spaceOf(root);
        if (!space) return ok(refusal('notSpace', 'not a Space'));
        const checked = checkName(name);
        if ('code' in checked) return ok(checked);
        const path = `.bava/templates/${group.trim() ? `${group.trim()}/` : ''}${checked.name}${PAGE_EXT}`;
        if (space.pages[path] && !replace) return ok(refusal('exists', `"${checked.name}" already exists`));
        space.pages[path] = { source, scene: structuredClone(scene) };
        return ok({ path });
      },
      async CreatePageFrom(root: string, folder: string, name: string, source: string, scene: FakePage['scene']) {
        const space = spaceOf(root);
        if (!space) return ok(refusal('notSpace', 'not a Space'));
        const made = apply(space, { kind: 'createPage', folder, name } as Op);
        if (made.error) return made;
        space.pages[made.path] = { source, scene: structuredClone(scene) };
        return made;
      },
      async Index(root: string, withText: boolean) {
        const space = spaceOf(root);
        if (!space) return { pages: null, folders: null, ...refusal('notSpace', 'not a Space') };
        // Every page in the tree's order, with its text when asked.
        const pages: { name: string; path: string; text: string }[] = [];
        const folders: string[] = [];
        const walk = (folder: string) => {
          for (const name of space.folders[folder] ?? []) {
            const path = join(folder, name);
            if (isFolder(space, path)) {
              folders.push(path);
              walk(path);
            } else pages.push({ name: linkName(path), path, text: withText ? space.pages[path].source : '' });
          }
        };
        walk('');
        return { pages, folders: folders.sort(), error: '', code: '' };
      },
      async Search(root: string, query: string, open: FakeOpenPage) {
        const space = spaceOf(root);
        if (!space) return { hits: [], more: false, ...refusal('notSpace', 'not a Space') };
        return { ...fakeSearch(space, query, open), error: '', code: '' };
      },
      async ZipPlan(root: string, scope: FakeZipScope) {
        const space = spaceOf(root);
        if (!space) return { files: [], ...refusal('notSpace', 'not a Space') };
        const plan = fakeZipPlan(space, scope);
        return Array.isArray(plan) ? { files: plan, error: '', code: '' } : { files: [], ...refusal(plan.code, plan.error) };
      },
      async ImportPlan(root: string, sources: string[], into: string) {
        const space = spaceOf(root);
        if (!space) return { plan: emptyImport(), ...refusal('notSpace', 'not a Space') };
        const plan = planImport(space, sources, into);
        return 'code' in plan ? { plan: emptyImport(), ...plan } : { plan, error: '', code: '' };
      },
      Import(root: string, name: string, sources: string[], into: string) {
        let cancelled = false;
        stops.set(name, () => void (cancelled = true));
        const run = (async () => {
          const space = spaceOf(root);
          if (!space) return { result: { plan: emptyImport(), pages: [], attached: {} }, ...refusal('notSpace', 'not a Space') };
          const plan = planImport(space, sources, into);
          if ('code' in plan) return { result: { plan: emptyImport(), pages: [], attached: {} }, ...plan };
          const made: string[] = [];
          const pages: { path: string; origin: number; from: string }[] = [];
          const attached: Record<string, string> = {};
          for (const [i, e] of plan.entries.entries()) {
            if (faults.slowImport) await new Promise((resolve) => setTimeout(resolve, faults.slowImport));
            if (cancelled) {
              // Undone, as Go undoes it: what this import made goes again.
              for (const path of made.reverse()) {
                remove(space, path);
                delete space.pages[path];
                delete space.folders[path];
              }
              return { result: { plan: emptyImport(), pages: [], attached: {} }, error: 'context canceled', code: 'cancelled' };
            }
            const source = `${plan.origins[e.origin].root}/${e.from}`;
            if (e.kind === 'folder') {
              insert(space, parentOf(e.to), baseOf(e.to));
              space.folders[e.to] = [];
              made.push(e.to);
            } else if (e.kind === 'page') {
              insert(space, parentOf(e.to), baseOf(e.to));
              space.pages[e.to] = { source: disk[source] ?? '', scene: { version: 1, elements: [] } };
              made.push(e.to);
              pages.push({ path: e.to, origin: e.origin, from: e.from });
            } else if (e.kind === 'file') {
              if (!space.attachments.some((file) => file.name === e.to)) space.attachments.push({ name: e.to, size: e.size, modified: '2026-10-12T09:00:00Z' });
              attached[`${e.origin}:${e.from}`] = e.to;
            }
            sendProgress('import', i + 1, plan.entries.length);
          }
          return { result: { plan, pages, attached }, error: '', code: '' };
        })();
        return run.finally(() => stops.delete(name));
      },
      ExportZip(root: string, name: string, scope: FakeZipScope, out: string) {
        let cancelled = false;
        stops.set(name, () => void (cancelled = true));
        const run = (async () => {
          const space = spaceOf(root);
          if (!space) return refusal('notSpace', 'not a Space');
          const plan = fakeZipPlan(space, scope);
          if (!Array.isArray(plan)) return refusal(plan.code, plan.error);
          for (const [i] of plan.entries()) {
            if (faults.slowZip) await new Promise((resolve) => setTimeout(resolve, faults.slowZip));
            // Nothing is written when cancelled, as Go leaves nothing at out.
            if (cancelled) return { error: 'context canceled', code: 'cancelled' };
            sendProgress('zip', i + 1, plan.length);
          }
          zips.push({ out, scope, files: plan.map((f) => f.path) });
          return { error: '', code: '' };
        })();
        return run.finally(() => stops.delete(name));
      },
      async Cancel(name: string) {
        stops.get(name)?.();
      },
      async Trash(root: string) {
        const space = spaceOf(root);
        if (!space) return { items: null, size: 0, ...refusal('notSpace', 'not a Space') };
        return { items: space.trash, size: space.trash.reduce((sum, item) => sum + item.size, 0), error: '', code: '' };
      },
      async ChooseFolder(title: string, near = '') {
        // A folder to import is one on the user's disk, outside the Space.
        if (title === 'Choose a folder to import') return { path: harness.importFolder, error: '' };
        // The user accepts the folder suggested, else picks the seeded Space.
        harness.chosenNear.push(near);
        const path = near || SPACE_ROOT;
        harness.lost = harness.lost.filter((p) => p !== path);
        return { path, error: '' };
      },
      // Everything is reachable unless a test marks it lost.
      async Reachable(paths: string[]) {
        return paths.map((p) => !harness.lost.includes(p));
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
        if (path in loose) return { path, source: loose[path].source, diagrams: null, scene: structuredClone(loose[path].scene), stamp, error: '' };
        const found = pageAt(path);
        if (faults.slowOpen) await new Promise((resolve) => setTimeout(resolve, faults.slowOpen));
        if (!found || found.rel === faults.unreadable) return { path, source: '', diagrams: null, scene: { version: 1, elements: [] }, stamp, error: `open ${path}: no such file` };
        const page = found.space.pages[found.rel];
        return { path, source: page.source, diagrams: null, scene: structuredClone(page.scene), stamp, error: '' };
      },
      async Save(path: string, source: string, scene: FakeSpace['pages'][string]['scene']) {
        if (faults.saveFails) throw new Error('the call to Save failed');
        if (path in loose) loose[path] = { source, scene: structuredClone(scene) };
        const found = pageAt(path);
        if (found) found.space.pages[found.rel] = { source, scene: structuredClone(scene) };
        return { path, stamp, error: '' };
      },
      async ChangedOnDisk(_path: string, _stamp: unknown) {
        return faults.changedOnDisk;
      },
      async ChooseFileToOpen() {
        return { path: harness.fileToOpen, error: '' };
      },
      async ChooseFileToSave(suggestedName: string) {
        return { path: `${PARENT}/${suggestedName}`, error: '' };
      },
      async ChooseMedia(kind: string) {
        return { paths: kind === 'import' ? [...harness.importFiles] : [], error: '' };
      },
      async ClipboardImage() {
        return '';
      },
      async FileDetails(_root: string, path: string) {
        // A file outside the Space is read only once the user chose it.
        if (/^(\.\.\/|\/)/.test(path)) {
          return harness.chosenFiles.includes(path) ? { exists: true, size: 5, modified: '2026-09-21T09:00:00Z', error: '', outside: false } : { exists: false, size: 0, modified: '', error: '', outside: true };
        }
        // The pretend Space's files: the one card fixture that is there.
        const there = path === '.bava/attachments/Q3 report.pdf';
        return { exists: there, size: there ? 248_000 : 0, modified: there ? '2026-09-21T09:00:00Z' : '', error: '' };
      },
      async OpenFile(_root: string, path: string) {
        // Outside the Space and not chosen yet: the dialog asks, the user picks it.
        if (/^(\.\.\/|\/)/.test(path) && !harness.chosenFiles.includes(path)) {
          harness.askedForFiles.push(path);
          harness.chosenFiles.push(path);
        }
        harness.openedFiles.push(path);
        return '';
      },
      async Settings() {
        const start = boot();
        if (!settingsRead) settings = { ...settings, ...start.settings };
        settingsRead = true;
        if (start.holdSettings) return new Promise<never>(() => {});
        if (start.failSettings) throw new Error('the call to Settings failed');
        return { ...settings };
      },
      async SaveSettings(next: typeof settings) {
        if (faults.settingsSaveFails) return 'write settings: permission denied';
        settings = { ...next };
        return '';
      },
    },
    RenderService: {
      async Render(source: string, _opts: unknown) {
        const errors = d2Errors(source);
        if (errors.length > 0) return { svg: '', errors, nodeMap: {}, layout: { shapes: [], connections: [] } };
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
      async PagePDF(root: string, request: (typeof pdfs)[number]['request'], out: string) {
        if (!request.document && !request.canvas) return { error: 'a PDF needs the Document, the Canvas or both', code: 'nothing' };
        pdfs.push({ root, out, request });
        return { error: '', code: '' };
      },
      SpacePDF(root: string, name: string, request: (typeof spacePdfs)[number]['request'], out: string) {
        let cancelled = false;
        stops.set(name, () => void (cancelled = true));
        const run = (async () => {
          if (!request.entries.some((e) => !e.folder)) return { error: 'a PDF needs a page', code: 'nothing', page: '' };
          const jammed = request.entries.find((e) => e.path === faults.unprintable);
          if (jammed) return { error: `export: ${jammed.path}: print the Document: the printer jammed`, code: 'page', page: jammed.path };
          if (faults.slowPrint) await new Promise((resolve) => setTimeout(resolve, faults.slowPrint));
          // Cancelled while printing: nothing is written, as Go writes nothing.
          if (cancelled) return { error: 'context canceled', code: 'cancelled', page: '' };
          spacePdfs.push({ root, out, request });
          return { error: '', code: '', page: '' };
        })();
        return run.finally(() => stops.delete(name));
      },
    },
    MenuService: {
      async SetState(_state: unknown) {},
    },
    LogService: {
      async Report(_entry: unknown) {},
      async TakeNotices() {
        return boot().notices ?? [];
      },
      async Diagnostics(_userAgent: string) {
        return '';
      },
      async OpenLogsFolder() {
        return '';
      },
      // Saved with the settings first, as Go saves it before the live level.
      async SetVerbose(on: boolean) {
        if (faults.settingsSaveFails) return 'write settings: permission denied';
        settings = { ...settings, verboseLogging: on };
        return '';
      },
    },
  };
}

export type Fakes = ReturnType<typeof createFakes>;
