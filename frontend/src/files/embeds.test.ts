import { describe, expect, it } from 'vitest';
import { embedsIn, pictureName, picturesOf } from './embeds';

describe("an embedded frame's picture name", () => {
  it('is the page’s name and the frame’s label', () => {
    expect(pictureName('Engineering/Architecture.md', 'Write path')).toBe('Architecture - Write path.png');
  });

  it('is the page’s name and Frame for a frame with no label', () => {
    expect(pictureName('Roadmap.md', null)).toBe('Roadmap - Frame.png');
    expect(pictureName('Roadmap.md', '   ')).toBe('Roadmap - Frame.png');
  });

  it('holds nothing a file name cannot', () => {
    expect(pictureName('Plan.md', 'Q3: in/out *now*?')).toBe('Plan - Q3- in-out -now--.png');
    expect(pictureName('Notes.md', '..hidden')).toBe('Notes - hidden.png');
  });
});

describe("a page's embeds", () => {
  it('names each frame, the page it is on, and its picture in the attachments', () => {
    const text =
      '<!-- bava: embed=f1 -->\n![Own](../.bava/attachments/Brief%20-%20Own.png)\n\n' +
      '<!-- bava: embed=f7 page="../Engineering/Architecture.md" -->\n![Write](../.bava/attachments/Architecture%20-%20Write.png)\n';
    expect(embedsIn('Marketing/Brief.md', text)).toEqual([
      { frame: 'f1', page: 'Marketing/Brief.md', picture: 'Brief - Own.png' },
      { frame: 'f7', page: 'Engineering/Architecture.md', picture: 'Architecture - Write.png' },
    ]);
  });

  it('is none in a page with no embed', () => {
    expect(embedsIn('Roadmap.md', '# Roadmap\n\n![Logo](.bava/attachments/logo.png)\n')).toEqual([]);
  });
});

describe('the pictures of a page’s frames', () => {
  const pages = [
    { name: 'Architecture', path: 'Engineering/Architecture.md', text: '<!-- bava: embed=f1 -->\n![A](../.bava/attachments/A.png)\n' },
    { name: 'Roadmap', path: 'Roadmap.md', text: '<!-- bava: embed=f1 page="Engineering/Architecture.md" -->\n![A](.bava/attachments/A.png)\n\n<!-- bava: embed=f2 page="Engineering/Architecture.md" -->\n![B](.bava/attachments/B.png)\n' },
    { name: 'Other', path: 'Other.md', text: '<!-- bava: embed=f1 -->\n![O](.bava/attachments/O.png)\n' },
  ];

  it('are every picture any page embeds of them, by frame', () => {
    expect(picturesOf(pages, 'Engineering/Architecture.md')).toEqual(
      new Map([
        ['f1', new Set(['A.png'])],
        ['f2', new Set(['B.png'])],
      ]),
    );
  });

  it('are none for a page whose frames no page embeds', () => {
    expect(picturesOf(pages, 'Nobody.md').size).toBe(0);
  });
});
