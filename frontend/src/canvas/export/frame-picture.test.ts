import { describe, expect, it, vi } from 'vitest';
import type { SceneElement } from '../scene';
import { frameArea, framePicture } from './frame-picture';

const el = (fields: Partial<SceneElement> & { id: string; type: string }) =>
  ({ x: 0, y: 0, w: 10, h: 10, z: 1, ...fields }) as unknown as SceneElement;

const scene = {
  elements: [
    el({ id: 'f1', type: 'frame', x: 100, y: 50, w: 400, h: 300, z: 1, label: 'Write path' } as never),
    el({ id: 'a', type: 'rect', x: 120, y: 80, z: 3, frame: 'f1' } as never),
    el({ id: 'inner', type: 'frame', x: 200, y: 100, w: 100, h: 100, z: 2, frame: 'f1' } as never),
    el({ id: 'b', type: 'ellipse', x: 210, y: 110, z: 4, frame: 'inner' } as never),
    el({ id: 'outside', type: 'rect', x: 600, y: 600, z: 5 }),
  ],
};

describe('a frame’s picture', () => {
  it('covers the frame’s own box, with nothing around it', () => {
    expect(frameArea(scene, 'f1')!.box).toEqual({ x: 100, y: 50, w: 400, h: 300 });
  });

  it('draws everything in the frame\'s area, frames inside it too, in paint order, without the frame itself', () => {
    expect(frameArea(scene, 'f1')!.elements.map((e) => e.id)).toEqual(['inner', 'a', 'b']);
  });

  it('draws what is over the area though the frame does not hold it, and what crosses its edge', () => {
    const drawnBefore = el({ id: 'drawn', type: 'rect', x: 150, y: 60, z: 6 });
    const acrossEdge = el({ id: 'edge', type: 'rect', x: 490, y: 340, w: 40, h: 40, z: 7 });
    const ids = frameArea({ elements: [...scene.elements, drawnBefore, acrossEdge] }, 'f1')!.elements.map((e) => e.id);
    expect(ids).toContain('drawn');
    expect(ids).toContain('edge');
  });

  it('leaves out what is wholly outside the area', () => {
    expect(frameArea(scene, 'f1')!.elements.map((e) => e.id)).not.toContain('outside');
  });

  it('is none for a frame not in the scene, or an element that is not a frame', () => {
    expect(frameArea(scene, 'gone')).toBeNull();
    expect(frameArea(scene, 'a')).toBeNull();
  });

  it('is drawn at twice size, on the canvas background, in the theme asked for', async () => {
    const draw = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
    const picture = await framePicture(scene, 'f1', { theme: 'dark', draw });
    expect(picture).toBeInstanceOf(Blob);
    expect(draw).toHaveBeenCalledWith(frameArea(scene, 'f1'), expect.objectContaining({ scale: 2, background: true, theme: 'dark' }));
    expect(await framePicture(scene, 'gone', { theme: 'light', draw })).toBeNull();
  });
});
