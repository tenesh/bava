/**
 * The open document: its path, whether it has unsaved changes, and the last
 * thing that went wrong.
 *
 * Saving over a file another program has rewritten is the one outcome with no
 * undo, so a save checks the disk first and refuses rather than asking
 * forgiveness. The caller decides what to do about the conflict.
 */
import { FileService } from '../../bindings/github.com/tenesh/bava/internal/app';
import type { Scene } from '../../bindings/github.com/tenesh/bava/internal/format/models';
import type { Stamp } from '../../bindings/github.com/tenesh/bava/internal/store/models';

export type OpenResult = {
  path: string;
  source: string;
  diagrams: Record<string, string> | null;
  scene: Scene;
  stamp: Stamp;
  error: string;
};

export type SaveResult = { path: string; stamp: Stamp; error: string };

/** The Go calls, injectable so the state can be tested without a backend. */
export type DocumentIO = {
  open(path: string): Promise<OpenResult>;
  save(path: string, source: string, scene: Scene): Promise<SaveResult>;
  changedOnDisk(path: string, stamp: Stamp): Promise<boolean>;
};

const overIPC: DocumentIO = {
  open: (path) => FileService.Open(path) as unknown as Promise<OpenResult>,
  save: (path, source, scene) =>
    FileService.Save(path, source, scene) as unknown as Promise<SaveResult>,
  changedOnDisk: (path, stamp) =>
    FileService.ChangedOnDisk(path, stamp) as unknown as Promise<boolean>,
};

export function createDocument(io: DocumentIO = overIPC) {
  let path = $state.raw<string | null>(null);
  let source = $state.raw('');
  let diagrams = $state.raw<Record<string, string>>({});
  let stamp = $state.raw<Stamp | null>(null);
  let dirty = $state.raw(false);
  let error = $state.raw<string | null>(null);

  return {
    get path() {
      return path;
    },
    get source() {
      return source;
    },
    get diagrams() {
      return diagrams;
    },
    get dirty() {
      return dirty;
    },
    get error() {
      return error;
    },

    /** Mark the document changed. Called by the canvas and the editor. */
    touch() {
      dirty = true;
    },

    async open(next: string): Promise<OpenResult> {
      const result = await io.open(next);
      if (result.error) {
        // The previous document stays open: replacing it with an empty window
        // because a different file failed to load loses the user's place.
        error = result.error;
        return result;
      }
      path = result.path;
      source = result.source;
      diagrams = result.diagrams ?? {};
      stamp = result.stamp;
      dirty = false;
      error = null;
      return result;
    },

    /**
     * Write to a new path — an untitled document, or Save As.
     *
     * Deliberately does not open the path first. The file usually does not
     * exist yet, and opening it fails and leaves no path to save to: exactly
     * how saving a new drawing was broken before this existed. There is no
     * conflict check either, because there is no earlier read to conflict with.
     */
    async saveAs(next: string, scene: Scene) {
      const result = await io.save(next, source, scene);
      if (result.error) {
        error = result.error;
        return { conflict: false, saved: false };
      }

      path = next;
      stamp = result.stamp;
      dirty = false;
      error = null;
      return { conflict: false, saved: true };
    },

    /** Take the disk's version, discarding local changes. */
    async reload() {
      if (path) return this.open(path);
      return null;
    },

    /**
     * Write the document. Returns `{conflict: true}` without writing if the
     * file changed on disk, unless the caller has already decided to overwrite.
     */
    async save(scene: Scene, options: { overwrite?: boolean } = {}) {
      if (!path) return { conflict: false, saved: false };

      if (!options.overwrite && stamp) {
        if (await io.changedOnDisk(path, stamp)) {
          return { conflict: true, saved: false };
        }
      }

      const result = await io.save(path, source, scene);
      if (result.error) {
        error = result.error;
        return { conflict: false, saved: false };
      }

      stamp = result.stamp;
      dirty = false;
      error = null;
      return { conflict: false, saved: true };
    },
  };
}
