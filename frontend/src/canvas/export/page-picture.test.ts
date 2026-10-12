import { describe, expect, it } from 'vitest';
import { pagePicture } from './page-picture';
import type { SceneData } from '../scene';

const read = (name: string) => (({ '--color-canvas-bg': 'black', '--color-shape-stroke': 'white' }) as Record<string, string>)[name] ?? '';
const fonts = { family: 'Geist', read: async () => new ArrayBuffer(4) };

describe('pagePicture', () => {
  it('is nothing for a Canvas that holds nothing', async () => {
    expect(await pagePicture({ elements: [] } as unknown as SceneData, { read, fonts })).toBeNull();
  });

  it("is the whole Canvas as an SVG, on the canvas's colour, with its size", async () => {
    const scene = { elements: [{ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1 }] } as unknown as SceneData;
    const picture = await pagePicture(scene, { read, fonts });
    expect(picture).toMatchObject({ width: 132, height: 82 });
    expect(picture?.svg).toContain('<svg');
    expect(picture?.svg).toContain('fill="black"');
  });

  // A page read from its file keeps an attached arrow's stored points, a
  // fallback: the picture ends it where it meets its shapes, as the canvas
  // does on opening, never through them.
  it("ends an attached arrow at its shapes' edges, not at the points stored", async () => {
    const scene = {
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 60, z: 1 },
        { id: 'b', type: 'rect', x: 300, y: 0, w: 100, h: 60, z: 2 },
        { id: 'ab', type: 'arrow', x: 50, y: 30, w: 300, h: 0, z: 3, points: [0, 0, 300, 0], arrowType: 'straight', startBinding: 'a', endBinding: 'b' },
      ],
    } as unknown as SceneData;
    const picture = await pagePicture(scene, { read, fonts });
    const arrow = picture!.svg.slice(picture!.svg.indexOf('data-id="ab"'));
    const start = Number(/points="(-?[\d.]+)/.exec(arrow)![1]);
    expect(start).toBeGreaterThanOrEqual(100);
    expect(scene.elements[2]).toMatchObject({ x: 50 });
  });
});
