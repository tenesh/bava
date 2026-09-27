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
      stamp: { size: 4, modifiedUnixNano: '1' },
      error: '',
    }),
    save: vi.fn().mockResolvedValue({
      path: '/w/notes.md',
      stamp: { size: 9, modifiedUnixNano: '2' },
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
      stamp: { size: 0, modifiedUnixNano: '0' },
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
    finish({ path: '/w/notes.md', stamp: { size: 9, modifiedUnixNano: '2' }, error: '' });

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
      save: vi.fn().mockResolvedValue({ path: '', stamp: { size: 0, modifiedUnixNano: '0' }, error: 'disk full' }),
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
      stubIO({ open: vi.fn().mockResolvedValue({ path: '', source: '', diagrams: null, scene: emptyScene, stamp: { size: 0, modifiedUnixNano: '0' }, error: 'cannot read' }) }),
    );
    await doc.open('/w/missing.md');
    expect(doc.isOpen).toBe(false);
    expect(doc.error).toBe('cannot read');
  });
});

describe('saving a new document', () => {
  // Every other test saves a document that had been opened first, which is
  // how this went unnoticed: saving an untitled drawing opened a file that
  // did not exist yet, failed, and never set a path to save to.
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
      save: vi.fn().mockResolvedValue({ path: '', stamp: { size: 0, modifiedUnixNano: '0' }, error: 'permission denied' }),
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
        stamp: { size: 1, modifiedUnixNano: '1' },
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

// Style keys ride on the element objects. The frontend models some
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
      // Bends, anchors and a label position.
      {
        id: 'a3',
        type: 'arrow',
        x: 0,
        y: 0,
        w: 80,
        h: 60,
        z: 6,
        points: [0, 0, 40, 60, 80, 0],
        startBinding: 's1',
        startAnchor: [0.125, 0.875],
        startMode: 'inside',
        fixedSegments: [{ index: 2, start: [40, 0], end: [40, 60] }],
        label: 'slides',
        labelPosition: 0.25,
      },
      { id: 'l1', type: 'line', x: 0, y: 100, w: 10, h: 10, z: 7, points: [0, 0, 5, 10, 10, 0] },
      // A closed, filled line, and a new element's kind written out.
      { id: 'l2', type: 'line', x: 0, y: 200, w: 10, h: 10, z: 8, points: [0, 0, 10, 0, 10, 10, 0, 0], closed: true, fill: 'blue', edges: 'round' },
      { id: 'a4', type: 'arrow', x: 0, y: 300, w: 40, h: 0, z: 9, points: [0, 0, 40, 0], arrowType: 'arc' },
      // A crow's-foot head and a label size on an arrow.
      { id: 'a5', type: 'arrow', x: 0, y: 400, w: 40, h: 0, z: 10, points: [0, 0, 40, 0], endArrowhead: 'zeroOrMany', label: 'has', fontSize: 28, labelDirection: 'along' },
      // A code block's size.
      { id: 'c2', type: 'code', x: 0, y: 500, w: 200, h: 40, z: 11, code: 'x', language: 'go', fontSize: 16, measuredWidth: 200, measuredHeight: 40 },
    ],
    grid: { size: 8 },
  };

  it('writes back every key it was given', async () => {
    const io = stubIO({
      open: vi.fn().mockResolvedValue({ path: '/w/styled.md', source: '', diagrams: {}, scene: styled, stamp: { size: 1, modifiedUnixNano: '1' }, error: '' }),
    });
    const doc = createDocument(io);
    const opened = await doc.open('/w/styled.md');
    const saved = sceneToSave(doc.sceneExtra, opened.scene.elements as unknown[]);
    expect(saved).toEqual(styled);
  });
});

// A page renamed or moved in the Files tree keeps its unsaved
// changes and its stamp; closing leaves no page open inside a Space.
describe('a page moved or closed', () => {
  it('follows its file to a new path, unsaved changes and all', async () => {
    const doc = createDocument(stubIO());
    await doc.open('/w/a.md');
    doc.touch();
    doc.moved('/w/F/b.md');
    expect(doc.path).toBe('/w/F/b.md');
    expect(doc.dirty).toBe(true);
    expect(doc.isOpen).toBe(true);
  });

  it('closes to no page at all', async () => {
    const doc = createDocument(stubIO());
    await doc.open('/w/a.md');
    doc.close();
    expect(doc.isOpen).toBe(false);
    expect(doc.path).toBeNull();
    expect(doc.dirty).toBe(false);
  });
});

// The Document editor gives its text when saving, not on every keystroke.
describe('the page text an editor holds', () => {
  it('is what a save writes, and becomes the source', async () => {
    const io = stubIO();
    const doc = createDocument(io);
    await doc.open('/w/notes.md');
    doc.bindSource(() => '# T\n\nNew line.\n');
    doc.touch();
    await doc.save(emptyScene);
    expect(io.save).toHaveBeenCalledWith('/w/notes.md', '# T\n\nNew line.\n', emptyScene);
    expect(doc.source).toBe('# T\n\nNew line.\n');
  });

  it('is what Save As writes too', async () => {
    const io = stubIO();
    const doc = createDocument(io);
    doc.reset();
    doc.bindSource(() => 'Typed\n');
    await doc.saveAs('/w/new.md', emptyScene);
    expect(io.save).toHaveBeenCalledWith('/w/new.md', 'Typed\n', emptyScene);
  });

  it('is let go, so the file\'s own text is used again', async () => {
    const io = stubIO();
    const doc = createDocument(io);
    await doc.open('/w/notes.md');
    const unbind = doc.bindSource(() => 'Other\n');
    unbind();
    await doc.save(emptyScene, { overwrite: true });
    expect(io.save).toHaveBeenCalledWith('/w/notes.md', '# T\n', emptyScene);
  });
});

// The editor is handed a page when one arrives, not as it is typed in.
describe('each page that arrives', () => {
  it('counts a new generation on open, reset, reload and close', async () => {
    const doc = createDocument(stubIO());
    const seen = [doc.generation];
    await doc.open('/w/notes.md');
    seen.push(doc.generation);
    await doc.reload();
    seen.push(doc.generation);
    doc.reset();
    seen.push(doc.generation);
    doc.close();
    seen.push(doc.generation);
    expect(new Set(seen).size).toBe(5);
  });

  it('keeps its generation through edits and saves', async () => {
    const doc = createDocument(stubIO());
    await doc.open('/w/notes.md');
    const before = doc.generation;
    doc.touch();
    await doc.save(emptyScene);
    expect(doc.generation).toBe(before);
  });
});
