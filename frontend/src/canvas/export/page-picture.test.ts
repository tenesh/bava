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
});
