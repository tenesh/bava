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

/** Everything in a scene except its elements: `version`, and unknown keys. */
export type SceneExtra = Record<string, unknown>;

/** The scene format generation this frontend writes. */
export const SCENE_VERSION = 1;

/**
 * The scene to save: this document's elements inside everything else the
 * opened scene held. A newer Bava's version and top-level keys go back as they
 * came; replacing them with `{version: 1}` would delete what the file format
 * promises to keep.
 */
export function sceneToSave(extra: SceneExtra, elements: unknown[]): Scene {
  return { version: SCENE_VERSION, ...extra, elements } as Scene;
}

function extraOf(scene: Scene | null | undefined): SceneExtra {
  if (!scene || typeof scene !== 'object') return {};
  const extra: SceneExtra = { ...(scene as Record<string, unknown>) };
  delete extra.elements;
  return extra;
}

export function createDocument(io: DocumentIO = overIPC) {
  // Bava launches with nothing open: New or a successful open opens one.
  let isOpen = $state.raw(false);
  let path = $state.raw<string | null>(null);
  let source = $state.raw('');
  let diagrams = $state.raw<Record<string, string>>({});
  let stamp = $state.raw<Stamp | null>(null);
  let dirty = $state.raw(false);
  // Counts edits. A save records the count it started from and marks the
  // document clean only if nothing changed while it was writing: an autosave
  // runs while the user keeps working.
  let revision = 0;
  let error = $state.raw<string | null>(null);
  let sceneExtra: SceneExtra = {};

  return {
    /** Whether any document, untitled or not, is open. */
    get isOpen() {
      return isOpen;
    },
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
    /** The opened scene's version and unknown top-level keys, for saving. */
    get sceneExtra(): SceneExtra {
      return sceneExtra;
    },

    /** Mark the document changed. Called by the canvas and the editor. */
    touch() {
      revision += 1;
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
      isOpen = true;
      path = result.path;
      source = result.source;
      diagrams = result.diagrams ?? {};
      sceneExtra = extraOf(result.scene);
      stamp = result.stamp;
      dirty = false;
      error = null;
      return result;
    },

    /**
     * Write to a new path: an untitled document, or Save As.
     *
     * Deliberately does not open the path first. The file usually does not
     * exist yet, and opening it fails and leaves no path to save to: exactly
     * how saving a new drawing was broken before this existed. There is no
     * conflict check either, because there is no earlier read to conflict with.
     */
    async saveAs(next: string, scene: Scene) {
      const started = revision;
      const result = await io.save(next, source, scene);
      if (result.error) {
        error = result.error;
        return { conflict: false, saved: false };
      }

      path = next;
      stamp = result.stamp;
      dirty = revision !== started;
      error = null;
      return { conflict: false, saved: true };
    },

    /** Become a new, clean, untitled document. The caller settles unsaved work first. */
    reset() {
      isOpen = true;
      path = null;
      source = '';
      diagrams = {};
      sceneExtra = {};
      stamp = null;
      dirty = false;
      error = null;
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
      const started = revision;

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
      dirty = revision !== started;
      error = null;
      return { conflict: false, saved: true };
    },
  };
}
