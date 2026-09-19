/**
 * The canvas as a PNG.
 *
 * Drawn by the real renderer: an offscreen `CanvasStage` renders the export's
 * elements exactly as the on-screen one does, so a PNG cannot disagree with
 * what the user is looking at. The stage is destroyed afterwards, always, or
 * every export would leak a canvas.
 */
import { CanvasStage } from '../stage';
import type { ReadVariable } from '../palette';
import type { ExportArea } from './area';
import type { Run } from '../code/highlight';
import { withTheme } from './theme';

export type PngOptions = {
  /**
   * Reads the theme variables. Given directly, it is used as is; otherwise the
   * document is put into `theme` for the drawing and put back afterwards.
   */
  read?: ReadVariable;
  /** The theme to export in, when no reader is given. */
  theme?: 'light' | 'dark';
  /** Pixels per scene unit: 1x, 2x or 3x (canvas-toolbar.md). */
  scale: number;
  /** Paint the canvas colour behind the drawing. */
  background?: boolean;
  /** The tokenised code of every block, which the stage cannot compute itself. */
  codeRuns?: Record<string, Run[][]>;
  /** Encodes the drawn canvas. Injected, so a test needs no browser encoder. */
  encode?: (canvas: HTMLCanvasElement) => Promise<Blob>;
  /** Called while the drawing happens, for tests that watch the swap. */
  onDraw?: () => void;
};

function encodeInBrowser(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('export: the browser could not encode the image'));
    }, 'image/png');
  });
}

/**
 * The area drawn to a PNG blob at `scale`.
 *
 * The drawing is synchronous so it can sit inside a theme swap; only the
 * encoding is awaited, by which time the screen is back in its own theme.
 */
export async function toPng(area: ExportArea, options: PngOptions): Promise<Blob> {
  const { box } = area;
  if (box.w <= 0 || box.h <= 0) throw new Error('export: there is nothing to export');

  const draw = (read: ReadVariable): HTMLCanvasElement => {
    // Offscreen but in the document: Konva reads the container's size at mount.
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    // Out of the way without a magic offset: fixed positioning keeps it out of
    // the layout, and hidden keeps it off the screen. Konva still measures it.
    Object.assign(host.style, {
      position: 'fixed',
      inset: '0 auto auto 0',
      visibility: 'hidden',
      pointerEvents: 'none',
      width: `${box.w}px`,
      height: `${box.h}px`,
    });
    document.body.append(host);

    const stage = new CanvasStage({ read });
    try {
      stage.mount(host);
      stage.resize(box.w, box.h);
      // The area's top-left corner sits at the stage's origin.
      stage.setViewport({ zoom: 1, pan: { x: -box.x, y: -box.y } });
      stage.render({ elements: area.elements });
      // The stage is handed its runs, here as on screen: highlighting is
      // asynchronous and a draw is not.
      for (const [id, runs] of Object.entries(options.codeRuns ?? {})) stage.setCodeRuns(id, runs);
      options.onDraw?.();
      const drawn = stage.toCanvas(options.scale);
      return options.background ? withBackground(drawn, read('--color-canvas-bg').trim()) : drawn;
    } finally {
      stage.destroy();
      host.remove();
    }
  };

  const canvas = options.read ? draw(options.read) : withTheme(options.theme ?? 'light', draw);
  return (options.encode ?? encodeInBrowser)(canvas);
}

/** The same image over a solid colour, since a stage draws no background. */
function withBackground(drawn: HTMLCanvasElement, colour: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = drawn.width;
  canvas.height = drawn.height;
  const context = canvas.getContext('2d');
  // No colour means the token could not be read: the drawing is returned as it
  // is rather than inventing a background that no theme asked for.
  if (!context || !colour) return drawn;
  context.fillStyle = colour;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(drawn, 0, 0);
  return canvas;
}
