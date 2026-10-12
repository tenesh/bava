/**
 * The open Space: its folders as the Files tree shows them.
 *
 * Every change goes through the Space service in Go, which does the real file
 * operation; this module only holds what was listed and which folders are
 * open. It emits nothing: the tree component renders it and reports what the
 * user did, and opening a page is the shell's decision.
 *
 * Which folders are open and the last page opened are per-viewer
 * conveniences, kept in localStorage per Space (docs/file-format.md, "What is
 * not in a file"). The order the user arranged lives in the Space's own
 * `.bava/space.json`, in Go.
 */
import { SpaceService } from "../../bindings/github.com/tharabyte/bava/internal/app";
import type { Operation } from "../../bindings/github.com/tharabyte/bava/internal/app/models";
import { t } from "../i18n/t";
import { newRun } from "../ipc/runs";
import { spaceMessage } from "./space-helpers";
import type { TemplateRef } from "./templates";
import type { Scene } from "../../bindings/github.com/tharabyte/bava/internal/format/models";
import type { ImportPlan as GoImportPlan, ImportResult as GoImported } from "../../bindings/github.com/tharabyte/bava/internal/space/models";

export type EntryKind = "page" | "folder";
export type SpaceEntry = { name: string; path: string; kind: EntryKind };
export type SpaceOp = Partial<Operation> & { kind: string };
export type OpOutcome = {
  path: string;
  id?: string;
  root?: string;
  /** Relink's pages that were not written: changed since they were read, or not writable. */
  missed?: string[];
  /** The attachment's name, for attach, attachData and renameAttachment. */
  name?: string;
  error: string;
};

/** A page of the Space, with its text when asked for. */
/** A page of the Space; `unreadable` when its text could not be read (so its links are not known). */
export type IndexPage = { name: string; path: string; text: string; unreadable?: boolean };

/** Where a search result is best shown: its name, a Document line, or a canvas element. */
export type SearchMatch = { where: 'name' | 'document' | 'canvas'; text: string; word: string; occurrence: number; element: string };
/** A page or folder a search found, as `SpaceService.Search` answers. */
export type SearchHit = { kind: 'page' | 'folder'; path: string; name: string; folder: string; count: number; best: SearchMatch };
/** What a Markdown zip exports: the Space, a folder or a page, with the attachments its pages use. */
export type ZipScope = { kind: 'space' | 'folder' | 'page'; path: string; attachments: string[] };
/** One file of a zip, at its path there. */
export type ZipFile = { path: string; size: number };
/** One thing an import brings: where it comes from in its pick, and where it lands. */
export type ImportEntry = { kind: string; origin: number; from: string; entry: string; to: string; size: number };
/** What an import brings and where, as `SpaceService.ImportPlan` answers it, its lists always there. */
export type ImportPlan = {
  into: string;
  origins: { path: string; root: string }[];
  entries: ImportEntry[];
  renames: { from: string; to: string }[];
  pages: number;
  files: number;
  templates: number;
  bytes: number;
};
/** What an import brought: the pages it wrote and the attachment each file became. */
export type Imported = { plan: ImportPlan; pages: { path: string; origin: number; from: string }[]; attached: Record<string, string> };
/** An import under way: what it brought when done, and a way to stop it. */
export type RunningImport = { done: Promise<{ result: Imported | null; error: string; cancelled: boolean }>; cancel(): void };
/** A zip being written: whether it was, and a way to stop it. */
export type RunningZip = { done: Promise<{ error: string; cancelled: boolean }>; cancel(): void };

/** The open page as the window holds it, searched in place of its file. */
export type SearchOpenPage = { path: string; source: string; scene: Scene } | null;

export type SpaceIO = {
  open(
    dir: string,
  ): Promise<{
    root: string;
    name: string;
    pageWidth: string;
    error: string;
    code?: string;
  }>;
  list(
    root: string,
    folder: string,
  ): Promise<{ entries: SpaceEntry[] | null; error: string }>;
  apply(
    root: string,
    op: SpaceOp,
  ): Promise<{
    path: string;
    id: string;
    root: string;
    missed?: string[] | null;
    name?: string;
    error: string;
    code?: string;
  }>;
  index(root: string, withText: boolean): Promise<{ pages: IndexPage[] | null; error: string }>;
  search(root: string, query: string, open: SearchOpenPage): Promise<{ hits: SearchHit[] | null; more: boolean; error: string }>;
  zipPlan(root: string, scope: ZipScope): Promise<{ files: ZipFile[] | null; error: string; code?: string }>;
  /** Writes the zip as the run named `run`: `cancel(run)` stops it, leaving nothing at `out`. */
  exportZip(root: string, run: string, scope: ZipScope, out: string): Promise<{ error: string; code?: string }>;
  importPlan(root: string, sources: string[], into: string): Promise<{ plan: GoImportPlan; error: string; code?: string }>;
  /** Imports as the run named `run`: `cancel(run)` stops it, and Go removes what it made. */
  import(root: string, run: string, sources: string[], into: string): Promise<{ result: GoImported; error: string; code?: string }>;
  /** Stops the run named `run`; its call then answers `cancelled`, once nothing it began is left. */
  cancel(run: string): Promise<void>;
  trash(
    root: string,
  ): Promise<{
    items: TrashEntry[] | null;
    size: number;
    error: string;
    code?: string;
  }>;
  chooseFolder(title: string, near?: string): Promise<{ path: string; error: string }>;
  reachable(paths: string[]): Promise<boolean[]>;
  create(
    parent: string,
    name: string,
  ): Promise<{
    root: string;
    name: string;
    pageWidth: string;
    error: string;
    code?: string;
  }>;
  reveal(root: string, path: string): Promise<{ error: string; code?: string }>;
  templates(root: string): Promise<{ templates: TemplateRef[] | null; error: string; code?: string }>;
  saveTemplate(root: string, group: string, name: string, source: string, scene: Scene, replace: boolean): Promise<{ path: string; error: string; code?: string }>;
  createPageFrom(root: string, folder: string, name: string, source: string, scene: Scene): Promise<{ path: string; error: string; code?: string }>;
};

/** A page's text and canvas, as a template holds them. */
export type PageContent = { source: string; scene: Scene };

/** A row being named: its kind and folder, and for a page made from a template, the name it starts with and the template. */
export type PendingNew = { kind: EntryKind; folder: string; name?: string; template?: string };

export type TrashEntry = {
  id: string;
  path: string;
  /** A page, a folder, or a file of Media. */
  kind: EntryKind | "attachment";
  deletedAt: string;
  size: number;
};

export type SpaceStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** One row of the Files tree: an entry and how deep it sits. */
export type TreeRow = { entry: SpaceEntry; depth: number };

/** Go's plan with its lists always there: Go sends an empty list as null. */
function importPlanOf(plan: GoImportPlan): ImportPlan {
  return {
    into: plan.into,
    origins: plan.origins ?? [],
    entries: plan.entries ?? [],
    renames: plan.renames ?? [],
    pages: plan.pages,
    files: plan.files,
    templates: plan.templates,
    bytes: plan.bytes,
  };
}

function importedOf(result: GoImported): Imported {
  const attached: Record<string, string> = {};
  for (const [key, name] of Object.entries(result.attached ?? {})) if (name) attached[key] = name;
  return { plan: importPlanOf(result.plan), pages: result.pages ?? [], attached };
}

const overIPC: SpaceIO = {
  open: (dir) => SpaceService.Open(dir),
  list: (root, folder) =>
    SpaceService.List(root, folder) as unknown as ReturnType<SpaceIO["list"]>,
  apply: (root, op) =>
    SpaceService.Apply(root, {
      path: "",
      folder: "",
      name: "",
      index: -1,
      id: "",
      width: "",
      edits: [],
      source: "",
      data: "",
      attachment: "",
      replace: false,
      ...op,
    }),
  index: (root, withText) =>
    SpaceService.Index(root, withText) as unknown as ReturnType<SpaceIO["index"]>,
  search: (root, query, open) =>
    SpaceService.Search(root, query, open) as unknown as ReturnType<SpaceIO["search"]>,
  zipPlan: (root, scope) => SpaceService.ZipPlan(root, scope) as unknown as ReturnType<SpaceIO["zipPlan"]>,
  exportZip: (root, run, scope, out) => SpaceService.ExportZip(root, run, scope, out),
  importPlan: (root, sources, into) => SpaceService.ImportPlan(root, sources, into),
  import: (root, run, sources, into) => SpaceService.Import(root, run, sources, into),
  cancel: (run) => SpaceService.Cancel(run),
  trash: (root) =>
    SpaceService.Trash(root) as unknown as ReturnType<SpaceIO["trash"]>,
  chooseFolder: (title, near = '') => SpaceService.ChooseFolder(title, near),
  reachable: async (paths) => (await SpaceService.Reachable(paths)) ?? paths.map(() => true),
  create: (parent, name) => SpaceService.Create(parent, name),
  reveal: (root, path) => SpaceService.Reveal(root, path),
  templates: (root) => SpaceService.Templates(root) as unknown as ReturnType<SpaceIO["templates"]>,
  saveTemplate: (root, group, name, source, scene, replace) =>
    SpaceService.SaveTemplate(root, group, name, source, scene, replace),
  createPageFrom: (root, folder, name, source, scene) =>
    SpaceService.CreatePageFrom(root, folder, name, source, scene),
};

const EXPANDED_KEY = "bava.space.expanded:";
const LAST_PAGE_KEY = "bava.space.lastPage:";

export function createSpace(
  io: SpaceIO = overIPC,
  options: { storage?: SpaceStorage } = {},
) {
  const storage = options.storage ?? safeLocalStorage();

  let root = $state.raw<string | null>(null);
  let name = $state.raw("");
  let pageWidth = $state.raw("");
  let error = $state.raw<string | null>(null);
  // Listed folders by path ("" is the top), and which are open.
  let folders = $state.raw<Record<string, SpaceEntry[]>>({});
  let expanded = $state.raw<string[]>([]);
  let pending = $state.raw<PendingNew | null>(null);
  let lastPage = $state.raw<string | null>(null);
  // Each refresh's id: an older listing that lands after a newer one is dropped.
  let listing = 0;

  function load<T>(key: string, fallback: T): T {
    try {
      const raw = storage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key: string, value: unknown) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // A convenience: it holds for this session.
    }
  }

  async function listFolder(folder: string): Promise<boolean> {
    if (!root) return false;
    const id = listing;
    const result = await io.list(root, folder);
    if (id !== listing) return false;
    if (result.error) {
      const next = { ...folders };
      delete next[folder];
      folders = next;
      return false;
    }
    folders = { ...folders, [folder]: result.entries ?? [] };
    return true;
  }

  function setExpanded(next: string[]) {
    expanded = next;
    if (root) save(EXPANDED_KEY + root, next);
  }

  /** Re-read the top and every open folder; forget open folders that are gone. */
  async function refresh() {
    if (!root) return;
    const at = root;
    const id = ++listing;
    const snapshot = expanded;
    // Built aside and shown once, so the tree never flashes empty.
    const next: Record<string, SpaceEntry[]> = {};
    const read = async (folder: string) => {
      const result = await io.list(at, folder);
      if (result.error) return false;
      next[folder] = result.entries ?? [];
      return true;
    };
    await read("");
    const kept: string[] = [];
    // Parents before children, so a folder whose parent went is dropped too.
    for (const folder of [...snapshot].sort(
      (a, b) => a.split("/").length - b.split("/").length,
    )) {
      const parentOk =
        !folder.includes("/") ||
        kept.includes(folder.slice(0, folder.lastIndexOf("/")));
      if (parentOk && (await read(folder))) kept.push(folder);
    }
    if (id !== listing || root !== at) return;
    // A folder opened or closed meanwhile: read again from what is open now.
    if (expanded !== snapshot) return refresh();
    folders = next;
    if (kept.length !== expanded.length) setExpanded(kept);
  }

  function rowsOf(folder: string, depth: number, out: TreeRow[]) {
    for (const entry of folders[folder] ?? []) {
      out.push({ entry, depth });
      if (entry.kind === "folder" && expanded.includes(entry.path))
        rowsOf(entry.path, depth + 1, out);
    }
  }

  return {
    get root() {
      return root;
    },
    get name() {
      return name;
    },
    get pageWidth() {
      return pageWidth;
    },
    get error() {
      return error;
    },
    get pending() {
      return pending;
    },
    /** Each listed folder's entries, "" for the top. */
    get folders() {
      return folders;
    },
    get expanded() {
      return expanded;
    },
    get lastPage() {
      return lastPage;
    },
    /** The tree as shown: each open folder's contents under it. */
    get rows(): TreeRow[] {
      const out: TreeRow[] = [];
      rowsOf("", 0, out);
      return out;
    },
    isExpanded(folder: string) {
      return expanded.includes(folder);
    },

    /** Open a folder as a Space. Resolves with an error message, or ''. */
    async open(dir: string): Promise<string> {
      const info = await io.open(dir);
      if (info.error) {
        error = spaceMessage(info);
        return error;
      }
      root = info.root;
      name = info.name;
      pageWidth = info.pageWidth;
      error = null;
      pending = null;
      expanded = load<string[]>(EXPANDED_KEY + info.root, []);
      lastPage = load<string | null>(LAST_PAGE_KEY + info.root, null);
      await refresh();
      return "";
    },

    close() {
      root = null;
      name = "";
      folders = {};
      expanded = [];
      pending = null;
      lastPage = null;
    },

    refresh,

    async toggle(folder: string) {
      if (expanded.includes(folder)) {
        setExpanded(
          expanded.filter((f) => f !== folder && !f.startsWith(folder + "/")),
        );
        return;
      }
      setExpanded([...expanded, folder]);
      await listFolder(folder);
    },

    async expand(folder: string) {
      if (folder === "" || expanded.includes(folder)) return;
      setExpanded([...expanded, folder]);
      await listFolder(folder);
    },

    /** Start naming a new page or folder in a folder; `from` a template, with the name it starts with. */
    beginNew(kind: EntryKind, folder: string, from?: { name: string; template: string }) {
      pending = from ? { kind, folder, ...from } : { kind, folder };
      if (folder !== "" && !expanded.includes(folder)) {
        setExpanded([...expanded, folder]);
        void listFolder(folder);
      }
    },

    cancelNew() {
      pending = null;
    },

    /** Make the page or folder being named. Resolves with its path, or an error. */
    async commitNew(typed: string, content?: PageContent): Promise<OpOutcome> {
      const naming = pending;
      if (!naming) return { path: "", error: t("space.nothingNamed") };
      if (content && naming.kind === "page" && root) {
        // Made from a template: the page holds its text and canvas from the start.
        pending = null;
        const made = await io.createPageFrom(root, naming.folder, typed, content.source, content.scene);
        if (made.error) {
          pending = { ...naming };
          return { path: "", error: spaceMessage(made) };
        }
        await refresh();
        return { path: made.path, error: "" };
      }
      const kind = naming.kind === "page" ? "createPage" : "createFolder";
      // Naming stops before the tree is re-read, so the tree never sees the
      // new listing with the row still there and starts naming it again.
      const result = await this.apply(
        { kind, folder: naming.folder, name: typed },
        {
          before: () => {
            pending = null;
          },
        },
      );
      // Refused: a new row object, so the tree starts naming it again.
      if (result.error) pending = { ...naming };
      return { path: result.path, error: result.error };
    },

    /** The Space's templates, by group; null when they could not be read. */
    async templates(): Promise<TemplateRef[] | null> {
      if (!root) return [];
      const listed = await Promise.resolve()
        .then(() => io.templates(root!))
        .catch(() => null);
      return !listed || listed.error ? null : (listed.templates ?? []);
    },

    /** Saves a page's text and canvas as a template: its path, or why not (`taken` when the name is). */
    async saveTemplate(group: string, name: string, content: PageContent, replace: boolean): Promise<{ path: string; error: string; taken: boolean }> {
      if (!root) return { path: "", error: t("space.noneOpen"), taken: false };
      const saved = await io.saveTemplate(root, group, name, content.source, content.scene, replace);
      return saved.error ? { path: "", error: spaceMessage(saved), taken: saved.code === "exists" } : { path: saved.path, error: "", taken: false };
    },

    /** Deletes a Space's `.bava` folder for good, the pages in its folders kept: why not, or null. */
    async deleteData(dir: string): Promise<string | null> {
      const result = await io.apply(dir, { kind: "deleteSpaceData" });
      return result.error ? spaceMessage(result) : null;
    },

    /**
     * Run an operation, then show the tree as it now is. `before` sees the
     * outcome ahead of the refresh, so the open page can follow a move before
     * anything else touches it; `refresh: false` skips re-reading, for an
     * operation that changes the root itself.
     */
    async apply(
      op: SpaceOp,
      options: {
        before?: (outcome: OpOutcome) => void | Promise<void>;
        refresh?: boolean;
      } = {},
    ): Promise<OpOutcome> {
      if (!root) return { path: "", error: t("space.noneOpen") };
      const result = await io.apply(root, op);
      if (result.error) return { path: "", error: spaceMessage(result) };
      const outcome = {
        path: result.path,
        id: result.id,
        root: result.root,
        missed: result.missed ?? [],
        name: result.name,
        error: "",
      };
      await options.before?.(outcome);
      if (options.refresh !== false) await refresh();
      return outcome;
    },

    /**
     * Every page in the Space, with its text when `withText` is set. Null when
     * they could not be read: not knowing is not "no pages", which would mark
     * every link to a page missing.
     */
    async index(withText: boolean): Promise<IndexPage[] | null> {
      if (!root) return [];
      const result = await io.index(root, withText).catch(() => null);
      if (!result || result.error) return null;
      return result.pages ?? [];
    },

    /**
     * The Space's pages and folders holding every word of `query`, and
     * whether there were more than were returned. Null when the search
     * failed.
     */
    async search(query: string, open: SearchOpenPage): Promise<{ hits: SearchHit[]; more: boolean } | null> {
      if (!root) return { hits: [], more: false };
      const result = await io.search(root, query, open).catch(() => null);
      if (!result || result.error) return null;
      return { hits: result.hits ?? [], more: result.more };
    },

    /** What a Markdown zip of `scope` will hold, or why it cannot be made. */
    async zipPlan(scope: ZipScope): Promise<{ files: ZipFile[]; error: string }> {
      if (!root) return { files: [], error: t("export.noSpace") };
      const result = await io.zipPlan(root, scope).catch((error: unknown) => ({ files: null, error: String(error) }));
      return { files: result.files ?? [], error: result.error ? spaceMessage(result as { error: string; code?: string }) : "" };
    },

    /** What importing `sources` (pages, folders or zips on disk) into the folder `into` would bring. */
    async importPlan(sources: string[], into: string): Promise<{ plan: ImportPlan | null; error: string }> {
      if (!root) return { plan: null, error: t("import.noSpace") };
      const result = await io.importPlan(root, sources, into).catch((error: unknown) => ({ plan: null, error: String(error), code: "" }));
      return result.error || !result.plan ? { plan: null, error: spaceMessage(result) } : { plan: importPlanOf(result.plan), error: "" };
    },

    /** Starts importing `sources` into `into`; `cancel` stops it and removes what it made. */
    startImport(sources: string[], into: string): RunningImport {
      if (!root) return { done: Promise.resolve({ result: null, error: t("import.noSpace"), cancelled: false }), cancel: () => {} };
      const run = newRun();
      const done = io.import(root, run, sources, into).then(
        (result) =>
          result.code === "cancelled"
            ? { result: null, error: "", cancelled: true }
            : result.error
              ? { result: null, error: spaceMessage(result), cancelled: false }
              : { result: importedOf(result.result), error: "", cancelled: false },
        (error: unknown) => ({ result: null, error: String(error), cancelled: false }),
      );
      return { done, cancel: () => void io.cancel(run) };
    },

    /** Starts writing the Markdown zip of `scope` to `out`; `cancel` stops it, leaving nothing there. */
    startExportZip(scope: ZipScope, out: string): RunningZip {
      if (!root) return { done: Promise.resolve({ error: t("export.noSpace"), cancelled: false }), cancel: () => {} };
      const run = newRun();
      const done = io.exportZip(root, run, scope, out).then(
        (result) =>
          result.code === "cancelled"
            ? { error: "", cancelled: true }
            : { error: result.error ? spaceMessage(result) : "", cancelled: false },
        (error: unknown) => ({ error: String(error), cancelled: false }),
      );
      return { done, cancel: () => void io.cancel(run) };
    },

    /** A folder moved or was renamed: keep it, and what is open inside it, open. */
    followMove(from: string, to: string) {
      if (!expanded.some((f) => f === from || f.startsWith(from + "/"))) return;
      setExpanded(
        expanded.map((f) =>
          f === from || f.startsWith(from + "/")
            ? to + f.slice(from.length)
            : f,
        ),
      );
    },

    /** The Space's folder was renamed: keep its open folders and last page under the new root. */
    carryTo(nextRoot: string) {
      save(EXPANDED_KEY + nextRoot, expanded);
      save(LAST_PAGE_KEY + nextRoot, lastPage);
    },

    /** Save the Space's default page width; '' clears it. */
    async setPageWidth(width: string): Promise<string> {
      const result = await this.apply({ kind: "setPageWidth", width });
      if (!result.error) pageWidth = width;
      return result.error;
    },

    rememberPage(path: string | null) {
      lastPage = path;
      if (root) save(LAST_PAGE_KEY + root, path);
    },

    /** A page's path relative to the Space, or null when it is outside it. */
    relative(absolute: string): string | null {
      if (!root) return null;
      const prefix =
        root.endsWith("/") || root.endsWith("\\")
          ? root
          : root + (root.includes("\\") && !root.includes("/") ? "\\" : "/");
      if (!absolute.startsWith(prefix)) return null;
      return absolute.slice(prefix.length).replaceAll("\\", "/");
    },

    absolute(relative: string): string {
      if (!root) return relative;
      const sep = root.includes("\\") && !root.includes("/") ? "\\" : "/";
      return (
        root + sep + (sep === "\\" ? relative.replaceAll("/", "\\") : relative)
      );
    },

    trash: async () => {
      if (!root) return { items: [], size: 0, error: t("space.noneOpen") };
      const result = await io.trash(root);
      return result.error ? { ...result, error: spaceMessage(result) } : result;
    },
    /** Show the Space or an item in the file manager: '' when it worked, else why not. */
    reveal: async (path = ""): Promise<string> => {
      if (!root) return t("space.noneOpen");
      const result = await io.reveal(root, path);
      return result.error ? spaceMessage(result) : "";
    },
    chooseFolder: (title: string, near = '') => io.chooseFolder(title, near),
    /** Whether Bava may reach each path now (a store's sandbox may have forgotten it). */
    reachable: (paths: string[]) => io.reachable(paths),

    /** Make a new folder named `name` in `parent`, ready to open as a Space. */
    async create(
      parent: string,
      folderName: string,
    ): Promise<{ root: string; error: string }> {
      const info = await io.create(parent, folderName);
      return info.error
        ? { root: "", error: spaceMessage(info) }
        : { root: info.root, error: "" };
    },
  };
}

export type SpaceState = ReturnType<typeof createSpace>;

function safeLocalStorage(): SpaceStorage {
  return {
    getItem: (key) => globalThis.localStorage.getItem(key),
    setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  };
}
