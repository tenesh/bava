import { describe, expect, it, vi } from 'vitest';
import type { SceneData } from '../canvas/scene';
import { embedFrame, frameGroups, redrawPictures, type EmbedIO } from './embed-actions';

const frame = (id: string, label?: string, y = 0) => ({ id, type: 'frame', x: 0, y, w: 100, h: 50, z: 0, label }) as never;
const scenes: Record<string, SceneData> = {
  'Roadmap.md': { elements: [frame('f1', 'Box'), frame('f2', undefined, 80)] },
  'Engineering/Architecture.md': { elements: [frame('f7', 'Write path')] },
};

const embedOf = (frameId: string, picture: string, page?: string) =>
  `<!-- bava: embed=${frameId}${page ? ` page="${page}"` : ''} -->\n![x](.bava/attachments/${picture})\n`;

function io(overrides: Partial<EmbedIO> = {}) {
  const saved: { name: string; replace: boolean; theme: string }[] = [];
  let theme = 'light';
  const taken = new Set<string>();
  const out: EmbedIO & { saved: typeof saved; setTheme: (next: string) => void } = {
    saved,
    setTheme: (next) => (theme = next),
    here: () => 'Roadmap.md',
    inSpace: () => true,
    offerSpace: vi.fn(async () => true),
    pages: async () => [
      { name: 'Roadmap', path: 'Roadmap.md', text: '# Roadmap\n' },
      { name: 'Architecture', path: 'Engineering/Architecture.md', text: '# Architecture\n' },
    ],
    scene: async (page) => scenes[page] ?? null,
    picture: async (scene, id) => (scene.elements.some((e) => e.id === id) ? new Blob([theme]) : null),
    save: vi.fn(async (name: string, _data: Blob, replace: boolean) => {
      let free = name;
      for (let n = 2; !replace && taken.has(free); n += 1) free = name.replace(/\.png$/, ` ${n}.png`);
      taken.add(free);
      saved.push({ name: free, replace, theme });
      return { name: free };
    }),
    insert: vi.fn(),
    notify: vi.fn(),
    ...overrides,
  };
  return out;
}

describe('the frame picker’s list', () => {
  it("lists this page's frames first, then each other page's under its name, by label", async () => {
    const groups = await frameGroups(io(), { thumb: async () => 'blob:t' });
    expect(groups.map((g) => [g.page, g.title, g.frames.map((f) => f.label)])).toEqual([
      [null, 'This page', ['Box', 'Frame']],
      ['Engineering/Architecture.md', 'Architecture', ['Write path']],
    ]);
    expect(groups[0].frames[0].thumb).toBe('blob:t');
  });

  it('leaves out pages with no frames', async () => {
    const groups = await frameGroups(io({ scene: async (page) => (page === 'Roadmap.md' ? scenes[page] : { elements: [] }) }), { thumb: async () => null });
    expect(groups.map((g) => g.page)).toEqual([null]);
  });
});

describe('embedding a frame', () => {
  it('writes its picture once, named for its page and label, and puts an embed at the caret', async () => {
    const ports = io();
    await embedFrame('f1', null, ports);
    expect(ports.saved).toEqual([{ name: 'Roadmap - Box.png', replace: false, theme: 'light' }]);
    expect(ports.insert).toHaveBeenCalledWith({ frame: 'f1', page: null, src: '.bava/attachments/Roadmap%20-%20Box.png', alt: 'Box' });
  });

  it("names another page's frame for that page, and writes its page relative to this one", async () => {
    const ports = io();
    await embedFrame('f7', 'Engineering/Architecture.md', ports);
    expect(ports.saved[0].name).toBe('Architecture - Write path.png');
    expect(ports.insert).toHaveBeenCalledWith({
      frame: 'f7',
      page: 'Engineering/Architecture.md',
      src: '.bava/attachments/Architecture%20-%20Write%20path.png',
      alt: 'Write path',
    });
  });

  it('reuses the picture a page already embeds of the same frame, writing nothing', async () => {
    const ports = io({
      pages: async () => [{ name: 'Notes', path: 'Notes.md', text: embedOf('f1', 'Roadmap%20-%20Old.png', 'Roadmap.md') }],
    });
    await embedFrame('f1', null, ports);
    expect(ports.save).not.toHaveBeenCalled();
    expect(ports.insert).toHaveBeenCalledWith(expect.objectContaining({ src: '.bava/attachments/Roadmap%20-%20Old.png' }));
  });

  it('calls a frame with no label Frame', async () => {
    const ports = io();
    await embedFrame('f2', null, ports);
    expect(ports.saved[0].name).toBe('Roadmap - Frame.png');
    expect(ports.insert).toHaveBeenCalledWith(expect.objectContaining({ alt: 'Frame' }));
  });

  it('asks a loose page to become a Space first, and embeds nothing when declined', async () => {
    const ports = io({ inSpace: () => false, offerSpace: vi.fn(async () => false) });
    await embedFrame('f1', null, ports);
    expect(ports.offerSpace).toHaveBeenCalled();
    expect(ports.save).not.toHaveBeenCalled();
    expect(ports.insert).not.toHaveBeenCalled();
  });

  it('says so when the frame cannot be drawn or is gone', async () => {
    const ports = io({ picture: async () => null });
    await embedFrame('f1', null, ports);
    await embedFrame('missing', null, ports);
    expect(ports.notify).toHaveBeenCalledTimes(2);
    expect(ports.notify).toHaveBeenCalledWith('The frame could not be embedded.');
    expect(ports.insert).not.toHaveBeenCalled();
  });

  it('says why when the picture cannot be written', async () => {
    const ports = io({ save: vi.fn(async () => ({ error: 'disk full' })) });
    await embedFrame('f1', null, ports);
    expect(ports.notify).toHaveBeenCalledWith('disk full');
    expect(ports.insert).not.toHaveBeenCalled();
  });
});

describe('saving a page keeps its pictures current', () => {
  const embedding = async () => [
    { name: 'Roadmap', path: 'Roadmap.md', text: embedOf('f1', 'Roadmap%20-%20Box.png') },
    { name: 'Notes', path: 'Notes.md', text: embedOf('f1', 'Roadmap%20-%20Box.png', 'Roadmap.md') },
  ];

  it('redraws each embedded frame’s picture in place, once per picture', async () => {
    const ports = io({ pages: embedding });
    await redrawPictures('Roadmap.md', scenes['Roadmap.md'], ports);
    expect(ports.saved).toEqual([{ name: 'Roadmap - Box.png', replace: true, theme: 'light' }]);
  });

  it('writes nothing for a frame no page embeds', async () => {
    const ports = io();
    await redrawPictures('Roadmap.md', scenes['Roadmap.md'], ports);
    expect(ports.save).not.toHaveBeenCalled();
  });

  it('draws in the theme Bava has when the page is saved', async () => {
    const ports = io({ pages: embedding });
    ports.setTheme('dark');
    await redrawPictures('Roadmap.md', scenes['Roadmap.md'], ports);
    expect(ports.saved[0].theme).toBe('dark');
  });

  it('leaves the picture of a frame that is gone as it is', async () => {
    const ports = io({ pages: embedding });
    await redrawPictures('Roadmap.md', { elements: [] }, ports);
    expect(ports.save).not.toHaveBeenCalled();
  });
});
