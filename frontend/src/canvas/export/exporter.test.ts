// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createExporter } from './exporter.svelte';
import type { SceneData } from '../scene';

const scene: SceneData = {
  elements: [
    { id: 'a', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 },
    { id: 'b', type: 'rect', x: 60, y: 0, w: 20, h: 20, z: 2 },
  ] as never[],
};

function setup(overrides: Record<string, unknown> = {}) {
  const io = {
    choosePath: vi.fn().mockResolvedValue('/w/diagram.png'),
    save: vi.fn().mockResolvedValue(''),
    copyPng: vi.fn().mockResolvedValue({ copied: true }),
    copySvg: vi.fn().mockResolvedValue({ copied: true }),
    toPng: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })),
    ...overrides,
  };
  const notify = vi.fn();
  const exporter = createExporter({
    scene: () => scene,
    selection: () => ['a'],
    documentName: () => 'plan.md',
    io: io as never,
    notify,
  });
  return { exporter, io, notify };
}

describe('the export dialog state', () => {
  it('opens with only-selected on when the caller asks for a selection export', () => {
    const { exporter } = setup();
    exporter.open({ onlySelected: true });
    expect(exporter.isOpen).toBe(true);
    expect(exporter.settings.onlySelected).toBe(true);
  });

  it('keeps settings between openings, so a choice is not made twice', () => {
    const { exporter } = setup();
    exporter.open();
    exporter.change({ scale: 3, background: false });
    exporter.close();
    exporter.open();
    expect(exporter.settings).toMatchObject({ scale: 3, background: false });
  });

  it('previews what the settings describe', () => {
    const { exporter } = setup();
    exporter.open();
    expect(exporter.preview()).toContain('<svg');
    // Two elements, so the whole canvas is wider than the one selected.
    const whole = exporter.preview();
    exporter.change({ onlySelected: true });
    expect(exporter.preview().length).toBeLessThan(whole.length);
  });
});

describe('writing an export to a file', () => {
  it('suggests a name from the document and writes what was drawn', async () => {
    const { exporter, io, notify } = setup();
    exporter.open();
    await exporter.exportAs('png');
    expect(io.choosePath).toHaveBeenCalledWith('plan.png');
    expect(io.save).toHaveBeenCalledTimes(1);
    const [path, contents] = io.save.mock.calls[0];
    expect(path).toBe('/w/diagram.png');
    expect(typeof contents).toBe('string');
    expect(notify).not.toHaveBeenCalled();
    expect(exporter.isOpen).toBe(false);
  });

  it('writes an SVG as text, with the font inside it', async () => {
    const { exporter, io } = setup();
    exporter.open();
    await exporter.exportAs('svg');
    expect(io.choosePath).toHaveBeenCalledWith('plan.svg');
    const [, contents] = io.save.mock.calls[0];
    expect(atob(contents)).toContain('<svg');
  });

  it('does nothing when the save dialog is cancelled', async () => {
    const { exporter, io } = setup({ choosePath: vi.fn().mockResolvedValue(null) });
    exporter.open();
    await exporter.exportAs('png');
    expect(io.save).not.toHaveBeenCalled();
  });

  it('says so when the write fails, and keeps the dialog open', async () => {
    const { exporter, notify } = setup({ save: vi.fn().mockResolvedValue('export: disk full') });
    exporter.open();
    await exporter.exportAs('png');
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    expect(exporter.isOpen).toBe(true);
  });
});

describe('copying an export', () => {
  it('copies a PNG and closes', async () => {
    const { exporter, io } = setup();
    exporter.open();
    await exporter.copy();
    expect(io.copyPng).toHaveBeenCalled();
    expect(exporter.isOpen).toBe(false);
  });

  // The Linux case: the webview refuses, so the user is told and the dialog is
  // opened, where the same picture can be written to a file instead.
  it('opens the dialog and says why when the clipboard refuses', async () => {
    const { exporter, notify } = setup({
      copyPng: vi.fn().mockResolvedValue({ copied: false, offerDialog: true, reason: 'not allowed' }),
    });
    await exporter.copyFromMenu('png');
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('not allowed'));
    expect(exporter.isOpen).toBe(true);
  });

  it('copies SVG as text without opening anything', async () => {
    const { exporter, io } = setup();
    await exporter.copyFromMenu('svg');
    expect(io.copySvg).toHaveBeenCalledWith(expect.stringContaining('<svg'));
    expect(exporter.isOpen).toBe(false);
  });
});

// Nothing here may reject at the caller: App calls these as `void`, so an
// unhandled rejection would be a silent failure with nothing shown.
describe('when a step fails', () => {
  it('says so instead of throwing while exporting', async () => {
    const { exporter, notify } = setup({ toPng: vi.fn().mockRejectedValue(new Error('no encoder')) });
    exporter.open();
    await expect(exporter.exportAs('png')).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('no encoder'));
  });

  it('says so instead of throwing while copying', async () => {
    const { exporter, notify } = setup({ copyPng: vi.fn().mockRejectedValue(new Error('clipboard exploded')) });
    await expect(exporter.copyFromMenu('png')).resolves.toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('clipboard exploded'));
  });

  // WebKit wants the clipboard item made inside the gesture, so the picture is
  // handed over before it has finished encoding.
  it('hands the clipboard the picture before it is encoded', async () => {
    const { exporter, io } = setup();
    await exporter.copyFromMenu('png');
    expect(io.copyPng).toHaveBeenCalledWith(expect.any(Promise));
  });
});

// 6.6 shipped a button that did nothing because a test injected past the
// wiring. These go through the exporter, the way the app calls it.
describe('exporting a code block', () => {
  const withCode: SceneData = {
    elements: [
      { id: 'c', type: 'code', x: 0, y: 0, w: 100, h: 40, z: 1, code: 'const a', measuredWidth: 100, measuredHeight: 40 },
    ] as never[],
  };

  function codeSetup() {
    const io = {
      choosePath: vi.fn().mockResolvedValue('/w/out.svg'),
      save: vi.fn().mockResolvedValue(''),
      copyPng: vi.fn().mockResolvedValue({ copied: true }),
      copySvg: vi.fn().mockResolvedValue({ copied: true }),
      toPng: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })),
    };
    const exporter = createExporter({
      scene: () => withCode,
      selection: () => [],
      documentName: () => 'notes.md',
      io: io as never,
      notify: vi.fn(),
      codeRuns: () => ({ c: [[{ text: 'const', kind: 'keyword' as const }, { text: ' a', kind: 'plain' as const }]] }),
    });
    return { exporter, io };
  }

  it('writes the code into the SVG, not an empty panel', async () => {
    const { exporter, io } = codeSetup();
    exporter.open();
    await exporter.exportAs('svg');
    const [, contents] = io.save.mock.calls[0];
    expect(atob(contents)).toContain('>const<');
  });

  it('shows the code in the preview too', () => {
    const { exporter } = codeSetup();
    exporter.open();
    expect(exporter.preview()).toContain('>const<');
  });

  it('hands the runs to the PNG renderer, which draws them', async () => {
    const { exporter, io } = codeSetup();
    exporter.open();
    await exporter.exportAs('png');
    const [, options] = io.toPng.mock.calls[0];
    expect(options.codeRuns).toMatchObject({ c: expect.any(Array) });
  });
});
