import { describe, expect, it, vi } from 'vitest';
import { createDocument, sceneToSave } from './document.svelte';

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

  it('reset makes it clean and untitled again', async () => {
    const doc = createDocument(stubIO());
    await doc.open('/w/notes.md');
    doc.touch();
    doc.reset();
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

  // An autosave runs while the user keeps working. A change made while the
  // write is in flight is not on disk, so it must not be marked saved.
  it('stays dirty when changed during a save', async () => {
    let finish: (value: unknown) => void = () => {};
    const io = stubIO({
      save: vi.fn(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      ),
    });
    const doc = createDocument(io);
    await doc.open('/w/notes.md');
    doc.touch();

    const saving = doc.save(emptyScene);
    await vi.waitFor(() => expect(io.save).toHaveBeenCalled());
    doc.touch();
    finish({ path: '/w/notes.md', stamp: { size: 9, modifiedUnixNano: 2 }, error: '' });

    expect((await saving).saved).toBe(true);
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

// Bava launches with nothing open. New and a successful open are the only
// ways in; a failed open from nothing leaves nothing open.
describe('whether a document is open', () => {
  it('starts with no document open', () => {
    expect(createDocument(stubIO()).isOpen).toBe(false);
  });

  it('new opens an untitled document', () => {
    const doc = createDocument(stubIO());
    doc.reset();
    expect(doc.isOpen).toBe(true);
    expect(doc.path).toBeNull();
  });

  it('a successful open opens', async () => {
    const doc = createDocument(stubIO());
    await doc.open('/w/notes.md');
    expect(doc.isOpen).toBe(true);
  });

  it('a failed open from nothing stays closed', async () => {
    const doc = createDocument(
      stubIO({ open: vi.fn().mockResolvedValue({ path: '', source: '', diagrams: null, scene: emptyScene, stamp: { size: 0, modifiedUnixNano: 0 }, error: 'cannot read' }) }),
    );
    await doc.open('/w/missing.md');
    expect(doc.isOpen).toBe(false);
    expect(doc.error).toBe('cannot read');
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

describe('the scene around the elements', () => {
  // A newer Bava may put keys beside `elements`, and a higher version. Saving
  // from this one must write both back, not replace them with {version: 1}.
  it('keeps the opened scene\'s version and unknown top-level keys for saving', async () => {
    const io = stubIO({
      open: vi.fn().mockResolvedValue({
        path: '/w/notes.md',
        source: '',
        diagrams: {},
        scene: { version: 2, elements: [{ id: 'e1' }], grid: { size: 8 } },
        stamp: { size: 1, modifiedUnixNano: 1 },
        error: '',
      }),
    });
    const doc = createDocument(io);
    await doc.open('/w/notes.md');

    const saved = sceneToSave(doc.sceneExtra, [{ id: 'e2' }]);
    expect(saved).toEqual({ version: 2, grid: { size: 8 }, elements: [{ id: 'e2' }] });
  });

  it('starts a new document at the current version with nothing extra', async () => {
    const doc = createDocument(stubIO());
    await doc.open('/w/notes.md');
    doc.reset();
    expect(sceneToSave(doc.sceneExtra, [])).toEqual({ version: 1, elements: [] });
  });
});

// Milestone 6.3's keys ride on the element objects. The frontend models some
// of them and must not drop the rest: a scene loaded and saved again is the
// scene that came in, plus this document's edits.
describe('style properties survive a load and a save', () => {
  const styled = {
    version: 1,
    elements: [
      {
        id: 's1',
        type: 'rect',
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        z: 1,
        fill: '#e03131',
        strokeWidth: 4,
        strokeStyle: 'dashed',
        edges: 'round',
        opacity: 60,
        angle: 45,
        locked: true,
        fontSize: 28,
        align: 'right',
        verticalAlign: 'top',
        someFutureKey: { nested: [1, 2] },
      },
      { id: 'a1', type: 'arrow', x: 0, y: 0, w: 5, h: 5, z: 2, points: [0, 0, 5, 5], arrowType: 'elbow', endArrowhead: 'triangle-outline' },
      // Attachment and containment: ids, kept even when the target is gone.
      { id: 'a2', type: 'arrow', x: 0, y: 0, w: 5, h: 5, z: 3, points: [0, 0, 5, 5], startBinding: 'r1', endBinding: 'went-away', label: 'edge label' },
      { id: 'f1', type: 'frame', x: 0, y: 0, w: 50, h: 50, z: 4, label: 'Frame' },
      { id: 'inside', type: 'rect', x: 5, y: 5, w: 10, h: 10, z: 5, frame: 'f1' },
    ],
    grid: { size: 8 },
  };

  it('writes back every key it was given', async () => {
    const io = stubIO({
      open: vi.fn().mockResolvedValue({ path: '/w/styled.md', source: '', diagrams: {}, scene: styled, stamp: { size: 1, modifiedUnixNano: 1 }, error: '' }),
    });
    const doc = createDocument(io);
    const opened = await doc.open('/w/styled.md');
    const saved = sceneToSave(doc.sceneExtra, opened.scene.elements as unknown[]);
    expect(saved).toEqual(styled);
  });
});
