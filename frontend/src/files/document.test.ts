import { describe, expect, it, vi } from 'vitest';
import { createDocument } from './document.svelte';

const emptyScene = { version: 1, elements: [] };

// Typed as the mocks themselves rather than as DocumentIO: spreading overrides
// into a DocumentIO-typed object widens each field back to a plain function and
// loses vi.fn()'s own methods.
function stubIO(over: Partial<Record<keyof ReturnType<typeof baseIO>, unknown>> = {}) {
  return { ...baseIO(), ...over } as ReturnType<typeof baseIO>;
}

function baseIO() {
  return {
    open: vi.fn().mockResolvedValue({
      path: '/w/notes.md',
      source: '# T\n',
      diagrams: {},
      scene: emptyScene,
      stamp: { size: 4, modifiedUnixNano: 1 },
      error: '',
    }),
    save: vi.fn().mockResolvedValue({
      path: '/w/notes.md',
      stamp: { size: 9, modifiedUnixNano: 2 },
      error: '',
    }),
    changedOnDisk: vi.fn().mockResolvedValue(false),
  };
}

describe('document state', () => {
  it('starts clean and untitled', () => {
    const doc = createDocument(stubIO());
    expect(doc.path).toBeNull();
    expect(doc.dirty).toBe(false);
  });

  it('is dirty after an edit and clean after a save', async () => {
    const io = stubIO();
    const doc = createDocument(io);
    await doc.open('/w/notes.md');
    expect(doc.dirty).toBe(false);

    doc.touch();
    expect(doc.dirty).toBe(true);

    await doc.save(emptyScene);
    expect(doc.dirty).toBe(false);
    expect(io.save).toHaveBeenCalled();
  });

  it('surfaces an open error without losing the previous document', async () => {
    const io = stubIO();
    const doc = createDocument(io);
    await doc.open('/w/notes.md');

    io.open.mockResolvedValueOnce({
      path: '/w/missing.md',
      source: '',
      diagrams: {},
      scene: emptyScene,
      stamp: { size: 0, modifiedUnixNano: 0 },
      error: 'open missing.md: no such file',
    });
    await doc.open('/w/missing.md');

    expect(doc.error).toContain('no such file');
    expect(doc.path).toBe('/w/notes.md');
  });

  // Saving over someone else's work is the one outcome there is no undo for.
  it('refuses to save when the file changed on disk', async () => {
    const io = stubIO({ changedOnDisk: vi.fn().mockResolvedValue(true) });
    const doc = createDocument(io);
    await doc.open('/w/notes.md');
    doc.touch();

    const result = await doc.save(emptyScene);

    expect(result.conflict).toBe(true);
    expect(io.save).not.toHaveBeenCalled();
    expect(doc.dirty).toBe(true);
  });

  it('saves anyway when the conflict is acknowledged', async () => {
    const io = stubIO({ changedOnDisk: vi.fn().mockResolvedValue(true) });
    const doc = createDocument(io);
    await doc.open('/w/notes.md');
    doc.touch();

    await doc.save(emptyScene, { overwrite: true });

    expect(io.save).toHaveBeenCalled();
    expect(doc.dirty).toBe(false);
  });

  it('reports a save failure and stays dirty', async () => {
    const io = stubIO({
      save: vi.fn().mockResolvedValue({ path: '', stamp: { size: 0, modifiedUnixNano: 0 }, error: 'disk full' }),
    });
    const doc = createDocument(io);
    await doc.open('/w/notes.md');
    doc.touch();

    await doc.save(emptyScene);

    expect(doc.error).toContain('disk full');
    expect(doc.dirty).toBe(true);
  });
});

describe('saving a new document', () => {
  // The flow this whole milestone exists for. Every earlier test saved a
  // document that had been opened first, which is how this went unnoticed:
  // saving an untitled drawing opened a file that did not exist yet, failed,
  // and never set a path to save to.
  it('saves an untitled document to a chosen path', async () => {
    const io = stubIO();
    const doc = createDocument(io);
    doc.touch();

    const result = await doc.saveAs('/w/new.md', emptyScene);

    expect(result.saved).toBe(true);
    expect(io.save).toHaveBeenCalledWith('/w/new.md', '', emptyScene);
    expect(doc.path).toBe('/w/new.md');
    expect(doc.dirty).toBe(false);
  });

  it('does not open the file first', async () => {
    const io = stubIO();
    const doc = createDocument(io);
    await doc.saveAs('/w/new.md', emptyScene);
    expect(io.open).not.toHaveBeenCalled();
  });

  // Save As on an existing document keeps its prose rather than blanking it.
  it('keeps the current source when saving under a new name', async () => {
    const io = stubIO();
    const doc = createDocument(io);
    await doc.open('/w/notes.md');

    await doc.saveAs('/w/copy.md', emptyScene);

    expect(io.save).toHaveBeenCalledWith('/w/copy.md', '# T\n', emptyScene);
    expect(doc.path).toBe('/w/copy.md');
  });

  it('stays untitled and dirty when the save fails', async () => {
    const io = stubIO({
      save: vi.fn().mockResolvedValue({ path: '', stamp: { size: 0, modifiedUnixNano: 0 }, error: 'permission denied' }),
    });
    const doc = createDocument(io);
    doc.touch();

    const result = await doc.saveAs('/root/new.md', emptyScene);

    expect(result.saved).toBe(false);
    expect(doc.path).toBeNull();
    expect(doc.dirty).toBe(true);
    expect(doc.error).toContain('permission denied');
  });
});
