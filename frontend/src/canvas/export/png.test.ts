// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toPng } from './png';
import { exportArea } from './area';
import type { SceneData } from '../scene';

afterEach(() => {
  document.body.innerHTML = '';
});

const read = (name: string) =>
  (({ '--color-shape-fill': 'ivory', '--color-shape-stroke': 'slategray', '--color-canvas-bg': 'white' }) as Record<
    string,
    string
  >)[name] ?? '';

const scene: SceneData = {
  elements: [{ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1 } as never],
};

/** Stands in for the browser's PNG encoder, which jsdom does not have. */
function encoder() {
  const seen: { width: number; height: number }[] = [];
  const encode = vi.fn(async (canvas: HTMLCanvasElement) => {
    seen.push({ width: canvas.width, height: canvas.height });
    return new Blob([], { type: 'image/png' });
  });
  return { encode, seen };
}

describe('exporting to PNG', () => {
  it('draws the padded area, at the scale asked for', async () => {
    const { encode, seen } = encoder();
    const area = exportArea(scene, []);
    await toPng(area, { read, scale: 2, encode });
    // 100x50 plus 16 padding on each side, doubled.
    expect(seen).toEqual([{ width: area.box.w * 2, height: area.box.h * 2 }]);
  });

  it('is one to one at scale 1, and triple at 3', async () => {
    const one = encoder();
    await toPng(exportArea(scene, []), { read, scale: 1, encode: one.encode });
    expect(one.seen[0]).toEqual({ width: 132, height: 82 });

    const three = encoder();
    await toPng(exportArea(scene, []), { read, scale: 3, encode: three.encode });
    expect(three.seen[0]).toEqual({ width: 396, height: 246 });
  });

  it('returns a PNG blob', async () => {
    const { encode } = encoder();
    const blob = await toPng(exportArea(scene, []), { read, scale: 1, encode });
    expect(blob.type).toBe('image/png');
  });

  // The offscreen stage is a Konva stage and a DOM node: leaving one behind on
  // every export would leak a canvas per export.
  it('leaves nothing behind, even when the drawing throws', async () => {
    const before = document.body.childElementCount;
    await expect(
      toPng(exportArea(scene, []), {
        read,
        scale: 1,
        encode: () => Promise.reject(new Error('no encoder')),
      }),
    ).rejects.toThrow('no encoder');
    expect(document.body.childElementCount).toBe(before);
  });

  it('refuses an empty area rather than making a zero-sized image', async () => {
    const { encode } = encoder();
    await expect(toPng(exportArea({ elements: [] }, []), { read, scale: 1, encode })).rejects.toThrow(/nothing/i);
  });
});

// The theme swap has to wrap the drawing only: an await inside it would let
// the app paint in the wrong theme, and the reader would go stale after.
describe('exporting in the other theme', () => {
  it('draws inside the swap and puts the screen back before encoding', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    let themeWhileDrawing: string | null = null;
    const encode = async () => {
      themeWhileDrawing = themeWhileDrawing ?? document.documentElement.getAttribute('data-theme');
      return new Blob([], { type: 'image/png' });
    };
    await toPng(exportArea(scene, []), { scale: 1, theme: 'dark', encode, onDraw: () => {
      themeWhileDrawing = document.documentElement.getAttribute('data-theme');
    } });
    expect(themeWhileDrawing).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    document.documentElement.removeAttribute('data-theme');
  });
});
