import { describe, expect, it } from 'vitest';
import { readCanvasClipboard } from './clipboard-read';
import { exportArea } from './export/area';
import { toSvg } from './export/svg';
import type { SceneData, SceneElement } from './scene';

const read = () => '';
const elements = [
  { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 60, z: 1, label: 'Fish & <chips> ]]> done' },
  { id: 'b', type: 'ellipse', x: 200, y: 0, w: 100, h: 60, z: 2 },
  { id: 'ab', type: 'arrow', x: 100, y: 30, w: 100, h: 0, z: 3, points: [0, 0, 100, 0], startBinding: 'a', endBinding: 'b' },
] as unknown as SceneElement[];

/** What Copy puts on the clipboard: the picture, with the elements inside it. */
const copied = (els: SceneElement[]) => toSvg(exportArea({ elements: els } as SceneData, []), { read, carry: els });

describe("Bava's shapes on the clipboard", () => {
  it('carry their elements inside the picture, escaped for XML', () => {
    const svg = copied(elements);
    expect(svg).toContain('<metadata id="bava-canvas">');
    expect(svg).not.toContain('<chips>');
    expect(svg).toContain('Fish &amp; &lt;chips&gt; ]]&gt; done');
  });

  it('read back exactly as they were copied', () => {
    expect(readCanvasClipboard(copied(elements))).toEqual(elements);
  });

  it('are nothing in plain text, a picture without them, or data that is not valid', () => {
    expect(readCanvasClipboard('Order taken')).toBeNull();
    expect(readCanvasClipboard(toSvg(exportArea({ elements } as SceneData, []), { read }))).toBeNull();
    expect(readCanvasClipboard('<svg><metadata id="bava-canvas">{not json</metadata></svg>')).toBeNull();
    expect(readCanvasClipboard('<svg><metadata id="bava-canvas">{"version":1,"elements":"x"}</metadata></svg>')).toBeNull();
  });

  // The clipboard holds whatever any app put there: nothing half-formed reaches the file.
  it('are nothing from a later version, of an unknown type, or without a place and size', () => {
    const wrapped = (data: unknown) => `<svg><metadata id="bava-canvas">${JSON.stringify(data)}</metadata></svg>`;
    const rect = { id: 'a', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 };
    expect(readCanvasClipboard(wrapped({ version: 1, elements: [rect] }))).toEqual([rect]);
    expect(readCanvasClipboard(wrapped({ version: 2, elements: [rect] }))).toBeNull();
    expect(readCanvasClipboard(wrapped({ version: 1, elements: [{ ...rect, type: 'hexagram' }] }))).toBeNull();
    expect(readCanvasClipboard(wrapped({ version: 1, elements: [{ ...rect, w: 'wide' }] }))).toBeNull();
    expect(readCanvasClipboard(wrapped({ version: 1, elements: [{ ...rect, z: undefined }] }))).toBeNull();
  });

  it("read an apostrophe either way it is written", () => {
    const svg = `<svg><metadata id="bava-canvas">{"version":1,"elements":[{"id":"a","type":"text","text":"Ana&#39;s &apos;bao&apos;","x":0,"y":0,"w":10,"h":10,"z":1}]}</metadata></svg>`;
    expect((readCanvasClipboard(svg)![0] as { text: string }).text).toBe("Ana's 'bao'");
  });
});
