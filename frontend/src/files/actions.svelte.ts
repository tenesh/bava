/**
 * Opening and saving, with the prompts that stop work being lost.
 *
 * The policy lives here rather than in markup because it is exactly the logic
 * that was broken: saving an untitled drawing never reached disk, opening
 * another file discarded unsaved changes without a word, and a save conflict
 * did nothing visible. Each of those is a test now.
 */
import type { Scene } from '../../bindings/github.com/tenesh/bava/internal/format/models';

export type PromptKind = 'unsaved' | 'conflict';

/** `unsaved` answers with save/discard/cancel; `conflict` with reload/overwrite/cancel. */
export type Choice = 'save' | 'discard' | 'reload' | 'overwrite' | 'cancel';

type SaveOutcome = { conflict: boolean; saved: boolean };

export type FileActionDocument = {
  readonly path: string | null;
  readonly dirty: boolean;
  open(path: string): Promise<{ error: string }>;
  save(scene: Scene, options?: { overwrite?: boolean }): Promise<SaveOutcome>;
  saveAs(path: string, scene: Scene): Promise<SaveOutcome>;
  reload(): Promise<unknown>;
  /** Become a new untitled document. */
  reset(): void;
};

export type FileActionOptions = {
  document: FileActionDocument;
  /** Shows a prompt and resolves with the user's choice. */
  ask(kind: PromptKind): Promise<Choice>;
  currentScene(): Scene;
  /** The native save dialog. Resolves null when cancelled. */
  chooseSavePath(): Promise<string | null>;
};

export function createFileActions(options: FileActionOptions) {
  const { document: doc, ask, currentScene, chooseSavePath } = options;

  async function save(): Promise<boolean> {
    if (!doc.path) {
      const path = await chooseSavePath();
      // Cancelling the dialog is a decision, not a failure.
      if (!path) return false;
      return (await doc.saveAs(path, currentScene())).saved;
    }

    const outcome = await doc.save(currentScene());
    if (!outcome.conflict) return outcome.saved;

    // Another program wrote the file. Overwriting it is the one outcome with
    // no undo, so the user decides.
    switch (await ask('conflict')) {
      case 'overwrite':
        return (await doc.save(currentScene(), { overwrite: true })).saved;
      case 'reload':
        await doc.reload();
        return false;
      default:
        return false;
    }
  }

  async function saveAs(): Promise<boolean> {
    const path = await chooseSavePath();
    if (!path) return false;
    return (await doc.saveAs(path, currentScene())).saved;
  }

  /** Resolves true when it is safe to replace the open document. */
  async function settleUnsaved(): Promise<boolean> {
    if (!doc.dirty) return true;
    switch (await ask('unsaved')) {
      case 'save':
        // If the save did not happen, going on would still lose the work.
        return save();
      case 'discard':
        return true;
      default:
        return false;
    }
  }

  /** Resolves true when the file is now open. */
  async function open(path: string): Promise<boolean> {
    if (!(await settleUnsaved())) return false;
    return !(await doc.open(path)).error;
  }

  /** Resolves true when a new untitled document replaced the open one. */
  async function create(): Promise<boolean> {
    if (!(await settleUnsaved())) return false;
    doc.reset();
    return true;
  }

  return { open, create, save, saveAs };
}
