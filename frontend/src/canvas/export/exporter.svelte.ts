/**
 * Export, as the app performs it: the dialog's settings, the preview, and what
 * each button does.
 *
 * The pieces below it are pure (`area`, `svg`, `png`, `fonts`, `clipboard`);
 * this holds the small amount of state the dialog needs and sequences them, so
 * `App.svelte` wires UI to it rather than orchestrating an export itself.
 */
import type { ElementId, SceneData, SceneElement } from '../scene';
import { readRootVariable, type ReadVariable } from '../palette';
import { exportArea, type ExportArea } from './area';
import { toSvg } from './svg';
import { toPng } from './png';
import { fontCss } from './fonts';
import { copyPng, copySvg, type CopyResult } from './clipboard';
import { withTheme } from './theme';
import type { Run } from '../code/highlight';

export type ExportFormat = 'png' | 'svg';

export type ExportSettings = {
  onlySelected: boolean;
  background: boolean;
  dark: boolean;
  scale: number;
};

export type ExportIO = {
  /** The native save dialog: a path, or null when cancelled. */
  choosePath: (suggestedName: string) => Promise<string | null>;
  /** Writes base64 bytes, returning an error message or ''. */
  save: (path: string, contentsBase64: string) => Promise<string>;
  /** The picture is handed over unawaited, for the clipboard's sake. */
  copyPng: (png: Promise<Blob>) => Promise<CopyResult>;
  copySvg: (svg: string) => Promise<CopyResult>;
  /** Draws a PNG. Injected so a test needs no browser encoder. */
  toPng: (
    area: ExportArea,
    options: {
      scale: number;
      theme: 'light' | 'dark';
      background: boolean;
      codeRuns?: Record<string, Run[][]>;
    },
  ) => Promise<Blob>;
};

export type ExporterOptions = {
  scene: () => SceneData;
  selection: () => ElementId[];
  /** The open document's file name, for the suggested export name. */
  documentName: () => string;
  io: ExportIO;
  notify: (message: string) => void;
  /**
   * The tokenised code of every block, from `canvas/code/runs.ts`. Both the
   * SVG writer and the offscreen stage need it: highlighting is asynchronous
   * and neither of them is.
   */
  codeRuns?: () => Record<string, Run[][]>;
  /** The mono advance the canvas is drawing with. */
  monoAdvance?: () => number;
};

const DEFAULTS: ExportSettings = { onlySelected: false, background: true, dark: false, scale: 2 };

/** Bytes to base64, in chunks: a spread of a large array overflows the stack. */
function base64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function createExporter(options: ExporterOptions) {
  const { io, notify } = options;
  let open = $state.raw(false);
  let settings = $state<ExportSettings>({ ...DEFAULTS });

  const area = (): ExportArea => exportArea(options.scene(), options.selection(), { onlySelected: settings.onlySelected });

  const theme = (): 'light' | 'dark' => (settings.dark ? 'dark' : 'light');

  /** The font stack the drawing uses; `fontCss` names the face after its first. */
  const fontStack = (): string => readRootVariable('--font-ui').trim() || 'Geist';
  const monoStack = (): string => readRootVariable('--font-mono').trim() || 'Geist Mono';

  /** The SVG for the current settings. `css` carries the font when asked. */
  function svgFor(current: ExportArea, css = '', read?: ReadVariable): string {
    const draw = (reader: ReadVariable) =>
      toSvg(current, {
        read: reader,
        background: settings.background,
        css,
        codeRuns: options.codeRuns?.(),
        monoAdvance: options.monoAdvance?.(),
      });
    // The preview and a written file resolve colours the same way: in the
    // theme the settings ask for, whatever the screen is showing.
    return read ? draw(read) : withTheme(theme(), draw);
  }

  async function writeFile(format: ExportFormat, current: ExportArea): Promise<void> {
    try {
      await write(format, current);
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error));
    }
  }

  async function write(format: ExportFormat, current: ExportArea): Promise<void> {
    const suggested = options.documentName().replace(/\.[^.]*$/, '') + `.${format}`;
    const path = await io.choosePath(suggested);
    if (!path) return;

    let contents: string;
    if (format === 'svg') {
      const css = await fontCss(current.elements, { family: fontStack(), monoFamily: monoStack() });
      contents = base64(new TextEncoder().encode(svgFor(current, css)));
    } else {
      const blob = await io.toPng(current, {
        scale: settings.scale,
        theme: theme(),
        background: settings.background,
        codeRuns: options.codeRuns?.(),
      });
      contents = base64(new Uint8Array(await blob.arrayBuffer()));
    }

    const error = await io.save(path, contents);
    if (error) {
      // The dialog stays open: the user still has an export to place.
      notify(error);
      return;
    }
    open = false;
  }

  async function putOnClipboard(format: ExportFormat, current: ExportArea): Promise<CopyResult> {
    if (format === 'svg') {
      const css = await fontCss(current.elements, { family: fontStack(), monoFamily: monoStack() });
      return io.copySvg(svgFor(current, css));
    }
    // Not awaited: the clipboard item has to be built from the picture while
    // the gesture that asked for it is still live (`clipboard.ts`).
    return io.copyPng(
      io.toPng(current, {
        scale: settings.scale,
        theme: theme(),
        background: settings.background,
        codeRuns: options.codeRuns?.(),
      }),
    );
  }

  async function copyOrOffer(format: ExportFormat): Promise<void> {
    let result: CopyResult;
    try {
      result = await putOnClipboard(format, area());
    } catch (error) {
      // Drawing the picture can fail (an empty canvas, a missing encoder).
      // The caller runs this as `void`, so nothing may escape.
      notify(error instanceof Error ? error.message : String(error));
      return;
    }
    if (result.copied) {
      open = false;
      return;
    }
    // A refused clipboard is the expected case on some systems, so the action
    // ends somewhere useful: the dialog, where the same picture is a file.
    notify(result.reason ?? '');
    if (result.offerDialog) open = true;
  }

  return {
    get isOpen(): boolean {
      return open;
    },
    get settings(): ExportSettings {
      return settings;
    },

    /** Open the dialog, optionally starting from a selection export. */
    open(initial: Partial<ExportSettings> = {}): void {
      settings = { ...settings, ...initial };
      open = true;
    },

    close(): void {
      open = false;
    },

    change(next: Partial<ExportSettings>): void {
      settings = { ...settings, ...next };
    },

    /** The SVG the dialog shows. No font: the preview is on screen already. */
    preview(): string {
      return svgFor(area());
    },

    /** PNG or SVG to a file the user picks. */
    exportAs(format: ExportFormat): Promise<void> {
      return writeFile(format, area());
    },

    /** The dialog's Copy button: the picture as a PNG. */
    copy(): Promise<void> {
      return copyOrOffer('png');
    },

    /** Copy as ▸ PNG or SVG, from the menu, with no dialog unless it fails. */
    copyFromMenu(format: ExportFormat): Promise<void> {
      return copyOrOffer(format);
    },
  };
}

export type Exporter = ReturnType<typeof createExporter>;

/** The real IO, for the app. Tests inject their own. */
export const exportIO = (io: Omit<ExportIO, 'toPng' | 'copyPng' | 'copySvg'>): ExportIO => ({
  ...io,
  copyPng: (png) => copyPng(png),
  copySvg: (svg) => copySvg(svg),
  toPng: (area, opts) => toPng(area, opts),
});

export type { SceneElement };
