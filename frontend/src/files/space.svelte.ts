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
import { SpaceService } from "../../bindings/github.com/tenesh/bava/internal/app";
import type { Operation } from "../../bindings/github.com/tenesh/bava/internal/app/models";
import { t } from "../i18n/t";
import { spaceMessage } from "./space-helpers";

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
  trash(
    root: string,
  ): Promise<{
    items: TrashEntry[] | null;
    size: number;
    error: string;
    code?: string;
  }>;
  chooseFolder(title: string): Promise<{ path: string; error: string }>;
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
};

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
  trash: (root) =>
    SpaceService.Trash(root) as unknown as ReturnType<SpaceIO["trash"]>,
  chooseFolder: (title) => SpaceService.ChooseFolder(title),
  create: (parent, name) => SpaceService.Create(parent, name),
  reveal: (root, path) => SpaceService.Reveal(root, path),
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
  let pending = $state.raw<{ kind: EntryKind; folder: string } | null>(null);
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

    /** Start naming a new page or folder in a folder. */
    beginNew(kind: EntryKind, folder: string) {
      pending = { kind, folder };
      if (folder !== "" && !expanded.includes(folder)) {
        setExpanded([...expanded, folder]);
        void listFolder(folder);
      }
    },

    cancelNew() {
      pending = null;
    },

    /** Make the page or folder being named. Resolves with its path, or an error. */
    async commitNew(typed: string): Promise<OpOutcome> {
      const naming = pending;
      if (!naming) return { path: "", error: t("space.nothingNamed") };
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
    chooseFolder: (title: string) => io.chooseFolder(title),

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
