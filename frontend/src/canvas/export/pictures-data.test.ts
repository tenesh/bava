import { describe, expect, it, vi } from 'vitest';
import { picturesData } from './pictures-data';
import { pictureAddress } from '../pictures';
import type { SceneElement } from '../scene';

const pictures = (...files: string[]) =>
  files.map((file, i) => ({ id: `p${i}`, type: 'image', file, x: 0, y: 0, w: 1, h: 1, z: i })) as unknown as SceneElement[];

const answer = (bytes: number[], type: string) =>
  ({ ok: true, headers: { get: () => type }, arrayBuffer: async () => new Uint8Array(bytes).buffer }) as unknown as Response;

describe('pictures carried inside an export', () => {
  it("are each file's bytes as a data address, fetched once per file", async () => {
    const fetcher = vi.fn(async () => answer([1, 2, 3], 'image/png'));
    const data = await picturesData('/space', pictures('a.png', 'a.png'), fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(pictureAddress('/space', 'a.png'));
    expect(data).toEqual({ 'a.png': 'data:image/png;base64,AQID' });
  });

  it('are missing when they cannot be read, or there is no Space', async () => {
    const gone = vi.fn(async () => ({ ok: false }) as Response);
    expect(await picturesData('/space', pictures('gone.png'), gone)).toEqual({ 'gone.png': null });
    expect(await picturesData(null, pictures('a.png'), gone)).toEqual({ 'a.png': null });
    expect(gone).toHaveBeenCalledTimes(1);
  });

  it('are nothing for a drawing without pictures', async () => {
    const fetcher = vi.fn();
    expect(await picturesData('/space', [{ id: 'r', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 1 } as SceneElement], fetcher)).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });
});
