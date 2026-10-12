import { describe, expect, it } from 'vitest';
import { canvasPictureFiles, renamedPictures } from './page-pictures';

const page = (elements: unknown[], fence = '```') =>
  `# Menu\n\nSome text naming nothing.\n\n${fence}bava-canvas\n${JSON.stringify({ elements, version: 1 }, null, 2)}\n${fence}\n`;

const picture = (id: string, file: string) => ({ file, h: 10, id, type: 'image', w: 10, x: 0, y: 0, z: 1 });

describe("the pictures a page's canvas shows", () => {
  it('are the files its picture elements name', () => {
    const text = page([picture('p1', 'har gow.png'), { id: 'r', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 2 }, picture('p2', 'siu mai.png')]);
    expect(canvasPictureFiles(text)).toEqual(['har gow.png', 'siu mai.png']);
  });

  it('are none for a page without a canvas, or with one that cannot be read', () => {
    expect(canvasPictureFiles('# Just words\n')).toEqual([]);
    expect(canvasPictureFiles('```bava-canvas\n{not json\n```\n')).toEqual([]);
  });

  it('are found inside a longer fence', () => {
    expect(canvasPictureFiles(page([picture('p1', 'a.png')], '````'))).toEqual(['a.png']);
  });
});

describe('a renamed picture in a page', () => {
  it('is renamed in its canvas, every other byte kept', () => {
    const text = page([picture('p1', 'har gow.png'), picture('p2', 'other.png')]);
    const after = renamedPictures(text, 'har gow.png', 'prawn "dumplings".png')!;
    expect(canvasPictureFiles(after)).toEqual(['prawn "dumplings".png', 'other.png']);
    expect(after.replace('"prawn \\"dumplings\\".png"', '"har gow.png"')).toBe(text);
  });

  it('leaves a page without it alone', () => {
    expect(renamedPictures(page([picture('p1', 'other.png')]), 'har gow.png', 'x.png')).toBeNull();
    expect(renamedPictures('# har gow.png in words only\n', 'har gow.png', 'x.png')).toBeNull();
  });

  it('is renamed in JSON written by hand, without spaces', () => {
    const text = '# Menu\n\n```bava-canvas\n{"elements":[{"id":"p","type":"image","file":"har gow.png","x":0,"y":0,"w":1,"h":1,"z":1}],"version":1}\n```\n';
    expect(canvasPictureFiles(renamedPictures(text, 'har gow.png', 'x.png')!)).toEqual(['x.png']);
  });

  it('is not claimed renamed when its writing could not be found', () => {
    // A name written with an escape where plain text would do.
    const text = '```bava-canvas\n{"elements":[{"id":"p","type":"image","file":"a\\u0062.png","x":0,"y":0,"w":1,"h":1,"z":1}]}\n```\n';
    expect(canvasPictureFiles(text)).toEqual(['ab.png']);
    expect(renamedPictures(text, 'ab.png', 'x.png')).toBeNull();
  });
});

describe('the canvas block, found as the app reads it', () => {
  const canvas = (file: string) => `\`\`\`bava-canvas\n${JSON.stringify({ elements: [picture('p', file)] })}\n\`\`\`\n`;

  it('is not an example of one shown inside a longer fence in the Document', () => {
    const text = `# How a canvas is stored\n\n\`\`\`\`markdown\n${canvas('example.png')}\`\`\`\`\n\n${canvas('real.png')}`;
    expect(canvasPictureFiles(text)).toEqual(['real.png']);
    const renamed = renamedPictures(text, 'example.png', 'x.png');
    expect(renamed).toBeNull();
  });

  it('is the last one when a page holds several', () => {
    expect(canvasPictureFiles(`${canvas('first.png')}\n${canvas('last.png')}`)).toEqual(['last.png']);
  });
});

