import { describe, expect, it, vi } from 'vitest';
import { createFileActions, type Choice, type PromptKind } from './actions.svelte';

const scene = { version: 1, elements: [] };

function doc(over: Record<string, unknown> = {}) {
  return {
    path: '/w/notes.md' as string | null,
    dirty: false,
    open: vi.fn().mockResolvedValue({ error: '' }),
    save: vi.fn().mockResolvedValue({ conflict: false, saved: true }),
    saveAs: vi.fn().mockResolvedValue({ conflict: false, saved: true }),
    reload: vi.fn().mockResolvedValue({ error: '' }),
    ...over,
  };
}

/** Answers every prompt with a fixed choice, and records what was asked. */
function answering(choice: Choice) {
  const asked: PromptKind[] = [];
  return {
    asked,
    ask: vi.fn(async (kind: PromptKind) => {
      asked.push(kind);
      return choice;
    }),
  };
}

function actionsFor(d: ReturnType<typeof doc>, prompt: ReturnType<typeof answering>, chosenPath: string | null = '/w/new.md') {
  return createFileActions({
    document: d,
    ask: prompt.ask,
    currentScene: () => scene,
    chooseSavePath: vi.fn().mockResolvedValue(chosenPath),
  });
}

describe('opening a file', () => {
  it('opens straight away when there is nothing unsaved', async () => {
    const d = doc();
    const prompt = answering('cancel');
    await actionsFor(d, prompt).open('/w/other.md');
    expect(prompt.asked).toEqual([]);
    expect(d.open).toHaveBeenCalledWith('/w/other.md');
  });

  // Opening another file used to discard unsaved work without a word.
  it('asks before discarding unsaved changes', async () => {
    const d = doc({ dirty: true });
    const prompt = answering('cancel');
    await actionsFor(d, prompt).open('/w/other.md');
    expect(prompt.asked).toEqual(['unsaved']);
  });

  it('does nothing when cancelled', async () => {
    const d = doc({ dirty: true });
    await actionsFor(d, answering('cancel')).open('/w/other.md');
    expect(d.open).not.toHaveBeenCalled();
    expect(d.save).not.toHaveBeenCalled();
  });

  it('opens without saving when discarded', async () => {
    const d = doc({ dirty: true });
    await actionsFor(d, answering('discard')).open('/w/other.md');
    expect(d.save).not.toHaveBeenCalled();
    expect(d.open).toHaveBeenCalledWith('/w/other.md');
  });

  it('saves first when asked to', async () => {
    const d = doc({ dirty: true });
    const order: string[] = [];
    d.save.mockImplementation(async () => {
      order.push('save');
      return { conflict: false, saved: true };
    });
    d.open.mockImplementation(async () => {
      order.push('open');
      return { error: '' };
    });

    await actionsFor(d, answering('save')).open('/w/other.md');

    expect(order).toEqual(['save', 'open']);
  });

  // If the save did not happen, opening would still lose the work.
  it('does not open when the save it was told to do fails', async () => {
    const d = doc({ dirty: true, save: vi.fn().mockResolvedValue({ conflict: false, saved: false }) });
    await actionsFor(d, answering('save')).open('/w/other.md');
    expect(d.open).not.toHaveBeenCalled();
  });
});

describe('saving', () => {
  it('asks for a path when the document is untitled', async () => {
    const d = doc({ path: null });
    await actionsFor(d, answering('cancel')).save();
    expect(d.saveAs).toHaveBeenCalledWith('/w/new.md', scene);
    expect(d.save).not.toHaveBeenCalled();
  });

  it('does nothing when the save dialog is cancelled', async () => {
    const d = doc({ path: null });
    await actionsFor(d, answering('cancel'), null).save();
    expect(d.saveAs).not.toHaveBeenCalled();
  });

  it('saves a titled document in place', async () => {
    const d = doc();
    await actionsFor(d, answering('cancel')).save();
    expect(d.save).toHaveBeenCalledWith(scene);
  });

  // A conflict used to do nothing visible: the user clicked Save and nothing
  // was saved, with no word as to why.
  it('asks when the file changed on disk', async () => {
    const d = doc({ save: vi.fn().mockResolvedValue({ conflict: true, saved: false }) });
    const prompt = answering('cancel');
    await actionsFor(d, prompt).save();
    expect(prompt.asked).toEqual(['conflict']);
  });

  it('overwrites when told to keep the local version', async () => {
    const d = doc({ save: vi.fn().mockResolvedValueOnce({ conflict: true, saved: false }) });
    d.save.mockResolvedValueOnce({ conflict: false, saved: true });

    await actionsFor(d, answering('overwrite')).save();

    expect(d.save).toHaveBeenLastCalledWith(scene, { overwrite: true });
  });

  it('reloads from disk when told to take the disk version', async () => {
    const d = doc({ save: vi.fn().mockResolvedValue({ conflict: true, saved: false }) });
    await actionsFor(d, answering('reload')).save();
    expect(d.reload).toHaveBeenCalled();
  });
});
