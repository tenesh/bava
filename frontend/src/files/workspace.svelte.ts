/**
 * The open workspace folder and its files.
 *
 * Listing is Go's job; this holds the result and the folder path, and emits
 * nothing. The tree component renders it and reports an activation; opening a
 * file is the shell's decision.
 */
import { FileService } from '../../bindings/github.com/tenesh/bava/internal/app';

export type Entry = { name: string; path: string; isDir: boolean };

export type WorkspaceIO = {
  list(dir: string): Promise<{ entries: Entry[] | null; error: string }>;
};

const overIPC: WorkspaceIO = {
  list: (dir) => FileService.ListWorkspace(dir) as unknown as Promise<{ entries: Entry[] | null; error: string }>,
};

export function createWorkspace(io: WorkspaceIO = overIPC) {
  let root = $state.raw<string | null>(null);
  let entries = $state.raw<Entry[]>([]);
  let error = $state.raw<string | null>(null);

  return {
    get root() {
      return root;
    },
    get entries() {
      return entries;
    },
    get error() {
      return error;
    },

    async open(dir: string) {
      const result = await io.list(dir);
      if (result.error) {
        error = result.error;
        return;
      }
      root = dir;
      entries = result.entries ?? [];
      error = null;
    },

    /** Re-read the folder after a save, or when the window regains focus. */
    async refresh() {
      if (root) await this.open(root);
    },
  };
}
