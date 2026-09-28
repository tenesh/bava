// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeSelection } from 'prosemirror-state';
import type { MenuNode } from '../canvas/context-menu';
import { DocEditor } from './editor';
import { commands } from './commands';
import { cardMenuItems, mediaMenuItems, mediaSetting, posterName } from './media-menu';

/** Every item's id, submenus opened. */
const ids = (items: MenuNode[]): string[] => items.flatMap((item) => (item.kind === 'item' ? [item.id] : item.kind === 'submenu' ? [item.id, ...ids(item.items)] : []));

describe("the media's menu", () => {
  it('offers the settings, caption, replace, rename, show and full screen for an image', () => {
    const got = ids(mediaMenuItems('image', { loop: false, muted: false, poster: null }, true));
    for (const id of ['m:width', 'm:set:width:small', 'm:set:width:', 'm:ratio', 'm:set:ratio:16:9', 'm:align', 'm:set:align:left', 'm:caption', 'm:replace', 'm:rename', 'm:reveal', 'm:fullscreen']) {
      expect(got, id).toContain(id);
    }
    expect(got).not.toContain('m:set:loop');
    expect(got).not.toContain('m:poster');
  });

  it('offers loop, mute and a poster frame for a video, and no full screen', () => {
    const got = ids(mediaMenuItems('video', { loop: false, muted: true, poster: 'still.png' }, true));
    for (const id of ['m:set:loop', 'm:set:muted', 'm:poster', 'm:noposter']) expect(got, id).toContain(id);
    expect(got).not.toContain('m:fullscreen');
  });

  it('offers no Show in folder for a file on the web', () => {
    expect(ids(mediaMenuItems('image', { loop: false, muted: false, poster: null }, false, true, true))).not.toContain('m:reveal');
  });

  it('offers renaming only a file in the attachments', () => {
    expect(ids(mediaMenuItems('image', { loop: false, muted: false, poster: null }, false))).not.toContain('m:rename');
  });

  it('on a page outside a Space, offers only what needs no Space', () => {
    const got = ids(mediaMenuItems('video', { loop: false, muted: false, poster: null }, false, false));
    for (const id of ['m:replace', 'm:rename', 'm:reveal', 'm:poster']) expect(got, id).not.toContain(id);
    expect(got).toContain('m:set:loop');
  });

  it('offers an online video its shape, a caption and the browser, and nothing of a file', () => {
    const got = ids(mediaMenuItems('video', { loop: false, muted: false, poster: null }, false, true, true, true));
    for (const id of ['m:width', 'm:ratio', 'm:align', 'm:caption', 'm:open']) expect(got, id).toContain(id);
    for (const id of ['m:set:loop', 'm:set:muted', 'm:poster', 'm:replace', 'm:rename', 'm:reveal']) expect(got, id).not.toContain(id);
  });

  it("offers a file card's looks, and its file's replace, rename and show", () => {
    const got = ids(cardMenuItems({ web: false, attachment: true, inSpace: true }));
    for (const id of ['c:look', 'c:look:link', 'c:look:card', 'c:look:extended', 'c:replace', 'c:rename', 'c:reveal']) expect(got, id).toContain(id);
    expect(got).not.toContain('c:refresh');
  });

  it("offers a web card's looks and a refresh of its details, and nothing of a file", () => {
    const got = ids(cardMenuItems({ web: true, attachment: false, inSpace: true }));
    for (const id of ['c:look:link', 'c:look:card', 'c:refresh']) expect(got, id).toContain(id);
    for (const id of ['c:replace', 'c:rename', 'c:reveal']) expect(got, id).not.toContain(id);
  });

  it('names a video frame kept as its poster after the video', () => {
    expect(posterName('.bava/attachments/demo%20clip.mp4')).toBe('demo clip poster.png');
    expect(posterName('../demo.mov')).toBe('demo poster.png');
    expect(posterName('clips/demo.mp4?v=a/b')).toBe('demo poster.png');
  });
});

let editor: DocEditor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function open(markdown: string) {
  const host = document.createElement('div');
  document.body.append(host);
  editor = new DocEditor();
  editor.mount(host, { onChange: vi.fn(), probeFile: async () => true });
  editor.setPage(markdown);
  return editor.view!;
}

describe('each setting, in the file', () => {
  const cases: [string, string, string][] = [
    ['![a](a.png)\n', 'm:set:width:small', '<!-- bava: width=small -->\n![a](a.png)\n'],
    ['<!-- bava: width=small -->\n![a](a.png)\n', 'm:set:width:', '![a](a.png)\n'],
    ['![a](a.png)\n', 'm:set:ratio:1:1', '<!-- bava: ratio=1:1 -->\n![a](a.png)\n'],
    ['![a](a.png)\n', 'm:set:align:right', '<!-- bava: align=right -->\n![a](a.png)\n'],
    ['<!-- bava: align=right -->\n![a](a.png)\n', 'm:set:align:', '![a](a.png)\n'],
    ['![v](v.mp4)\n', 'm:set:loop', '<!-- bava: loop -->\n![v](v.mp4)\n'],
    ['<!-- bava: loop -->\n![v](v.mp4)\n', 'm:set:loop', '![v](v.mp4)\n'],
    ['![v](v.mp4)\n', 'm:set:muted', '<!-- bava: muted -->\n![v](v.mp4)\n'],
    ['<!-- bava: poster="p.png" -->\n![v](v.mp4)\n', 'm:noposter', '![v](v.mp4)\n'],
  ];
  for (const [page, id, want] of cases) {
    it(`${id} on ${JSON.stringify(page)}`, () => {
      const view = open(page);
      const attrs = mediaSetting(id, view.state.doc.firstChild!.attrs);
      expect(attrs).not.toBeNull();
      editor!.setMediaAttrs(0, attrs!);
      expect(editor!.markdown()).toBe(want);
    });
  }

  it('is nothing for an item that is not a setting', () => {
    expect(mediaSetting('m:rename', {})).toBeNull();
  });
});

describe('deleting a medium', () => {
  it('takes it out of this page only: nothing else is asked for', () => {
    const view = open('Before\n\n![a](.bava/attachments/a.png)\n\nAfter\n');
    let at = -1;
    view.state.doc.forEach((node, offset) => {
      if (node.type.name === 'image') at = offset;
    });
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, at)));
    editor!.run(commands.deleteBlock);
    expect(editor!.markdown()).toBe('Before\n\nAfter\n');
  });
});
