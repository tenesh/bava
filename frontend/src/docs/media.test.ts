// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { NodeSelection } from 'prosemirror-state';
import { DocEditor } from './editor';
import { openEditor, settle } from './test-editor';
import { mediaRelinkAddress, mediaUrl, mediaView } from './media';

describe('where a media block is loaded from', () => {
  const place = { root: '/Users/ana/Space', here: 'Notes/Page.md' };

  it('is the file route, with the folder the user opened and the file inside it', () => {
    const url = new URL(mediaUrl(place, '../.bava/attachments/a%20b.png')!, 'http://app');
    expect(url.pathname).toBe('/bava-file/');
    expect(url.searchParams.get('root')).toBe('/Users/ana/Space');
    expect(url.searchParams.get('path')).toBe('.bava/attachments/a b.png');
  });

  it('is its own address on the web, with or without a folder opened', () => {
    expect(mediaUrl(place, 'https://example.com/chart.png')).toBe('https://example.com/chart.png');
    expect(mediaUrl(null, 'http://example.com/clip.mp4')).toBe('http://example.com/clip.mp4');
  });

  it('is nowhere for an address that leaves the folder, or with no folder opened', () => {
    expect(mediaUrl(place, '../../outside.png')).toBeNull();
    expect(mediaUrl(null, 'a.png')).toBeNull();
  });

  it('can be relinked to the file of its name in the attachments, unless it is that file', () => {
    expect(mediaRelinkAddress(place, 'img/logo%20mark.png')).toBe('../.bava/attachments/logo%20mark.png');
    expect(mediaRelinkAddress(place, '../.bava/attachments/logo.png')).toBeNull();
  });
});

let editor: DocEditor | null = null;

/** Opens a page whose files the probe answers: `present` lists the paths the route has. */
function open(markdown: string, present: string[] = []) {
  const probe = vi.fn(async (url: string) => present.includes(new URL(url, 'http://app').searchParams.get('path') ?? ''));
  const options = { onChange: vi.fn(), probeFile: probe };
  const opened = openEditor(markdown, options);
  editor = opened.editor;
  const { host } = opened;
  editor.setMediaPlace({ root: '/Space', here: 'Page.md' });
  return { ...options, view: editor.view!, host };
}

describe('an image in the page', () => {
  it('is drawn from the file route with its settings and caption', () => {
    const { host } = open('<!-- bava: width=small ratio=4:3 align=left caption="The logo" -->\n![Logo](.bava/attachments/logo.png)\n');
    const figure = host.querySelector('figure.media')!;
    expect(figure.getAttribute('data-width')).toBe('small');
    expect(figure.getAttribute('data-ratio')).toBe('4:3');
    expect(figure.getAttribute('data-align')).toBe('left');
    expect(figure.querySelector('figcaption')!.textContent).toBe('The logo');
    const img = figure.querySelector('img')!;
    expect(new URL(img.src).searchParams.get('path')).toBe('.bava/attachments/logo.png');
    expect(img.alt).toBe('Logo');
  });

  it('is loading until its file has loaded, then ready', () => {
    const { host } = open('![Logo](.bava/attachments/logo.png)\n');
    const figure = host.querySelector('figure.media')!;
    expect(figure.getAttribute('data-state')).toBe('loading');
    figure.querySelector('img')!.dispatchEvent(new Event('load'));
    expect(figure.getAttribute('data-state')).toBe('ready');
  });

  it('changes in place when a setting changes: the same element, never drawn again', () => {
    const { host, view } = open('![Logo](.bava/attachments/logo.png)\n');
    const figure = host.querySelector('figure.media')!;
    const img = figure.querySelector('img')!;
    view.dispatch(view.state.tr.setNodeMarkup(0, null, { ...view.state.doc.firstChild!.attrs, width: 'large', caption: 'Big' }));
    expect(host.querySelector('figure.media')).toBe(figure);
    expect(figure.querySelector('img')).toBe(img);
    expect(figure.getAttribute('data-width')).toBe('large');
    expect(figure.querySelector('figcaption')!.textContent).toBe('Big');
  });

  it('is selected as a whole', () => {
    const { host, view } = open('![Logo](.bava/attachments/logo.png)\n');
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)));
    expect(host.querySelector('figure.media')!.classList.contains('ProseMirror-selectednode')).toBe(true);
  });

  it('shows as missing when its file is not there, offering the file of its name in the attachments', async () => {
    const { host, onChange } = open('![Logo](img/logo.png)\n', ['.bava/attachments/logo.png']);
    const figure = host.querySelector('figure.media')!;
    figure.querySelector('img')!.dispatchEvent(new Event('error'));
    await settle();
    await settle();
    expect(figure.getAttribute('data-state')).toBe('missing');
    const relink = figure.querySelector('button')!;
    expect(relink.textContent).toBe('Relink to logo.png');
    // Nothing changes until it is pressed.
    expect(onChange).not.toHaveBeenCalled();
    relink.click();
    expect(editor!.markdown()).toBe('![Logo](.bava/attachments/logo.png)\n');
  });

  it('offers nothing when no file of its name is in the attachments', async () => {
    const { host } = open('![Logo](img/logo.png)\n');
    const figure = host.querySelector('figure.media')!;
    figure.querySelector('img')!.dispatchEvent(new Event('error'));
    await settle();
    await settle();
    expect(figure.getAttribute('data-state')).toBe('missing');
    expect(figure.querySelector('button')).toBeNull();
  });
});

describe('a video in the page', () => {
  it("shows its first frame as the page opens, not a blank box", () => {
    const { host } = open('![Demo](.bava/attachments/demo.mp4)\n');
    const video = host.querySelector('video')!;
    expect(video.preload).toBe('metadata');
    expect(video.getAttribute('src')).toMatch(/#t=0\.001$/);
  });

  it('waits for play, with the webview player, its poster, loop and mute', () => {
    const { host } = open('<!-- bava: poster="still.png" loop muted -->\n![Demo](.bava/attachments/demo.mp4)\n');
    const video = host.querySelector('video')!;
    expect(video.autoplay).toBe(false);
    expect(video.controls).toBe(true);
    expect(video.preload).toBe('metadata');
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
    expect(new URL(video.poster).searchParams.get('path')).toBe('.bava/attachments/still.png');
  });

  it('is ready once the player knows the video', () => {
    const { host } = open('![Demo](.bava/attachments/demo.mp4)\n');
    const figure = host.querySelector('figure.media')!;
    expect(figure.getAttribute('data-state')).toBe('loading');
    figure.querySelector('video')!.dispatchEvent(new Event('loadedmetadata'));
    expect(figure.getAttribute('data-state')).toBe('ready');
  });

  it('shows the first frame of a video on the web too, and plays nothing by itself', () => {
    const { host } = open('![Clip](https://example.com/clip.mp4)\n');
    const video = host.querySelector('video')!;
    expect(video.preload).toBe('metadata');
    expect(video.autoplay).toBe(false);
    expect(video.getAttribute('src')).toBe('https://example.com/clip.mp4#t=0.001');
  });

  it('says an image on the web could not be loaded, and asks no one whether it is there', async () => {
    const { host, probeFile } = open('![Chart](https://example.com/chart.png)\n');
    const figure = host.querySelector('figure.media')!;
    figure.querySelector('img')!.dispatchEvent(new Event('error'));
    await settle();
    expect(figure.getAttribute('data-state')).toBe('missing');
    expect(figure.textContent).toContain('chart.png could not be loaded');
    expect(probeFile).not.toHaveBeenCalled();
  });

  it('keeps the same player element when a setting changes', () => {
    const { host, view } = open('![Demo](.bava/attachments/demo.mp4)\n');
    const video = host.querySelector('video')!;
    view.dispatch(view.state.tr.setNodeMarkup(0, null, { ...view.state.doc.firstChild!.attrs, loop: true, caption: 'Demo' }));
    expect(host.querySelector('video')).toBe(video);
    expect(video.loop).toBe(true);
  });

  it('keeps a player that stays when typing elsewhere in the page', () => {
    const { host, view } = open('Before\n\n![Demo](.bava/attachments/demo.mp4)\n');
    const video = host.querySelector('video')!;
    view.dispatch(view.state.tr.insertText('typed ', 1));
    expect(host.querySelector('video')).toBe(video);
  });

  it('leaves clicks and keys on the player to the player, and its changes to its own elements unread', () => {
    const { view } = open('![Demo](.bava/attachments/demo.mp4)\n');
    const node = view.state.doc.firstChild!;
    const context = { place: () => null, probe: async () => false, watchPlace: () => () => {}, relink: vi.fn() };
    const nodeView = mediaView(node, view, () => 0, context);
    const player = nodeView.dom!.querySelector('video')!;
    const on = (type: string) => {
      const event = type === 'keydown' ? new KeyboardEvent(type, { bubbles: true }) : new MouseEvent(type, { bubbles: true });
      Object.defineProperty(event, 'target', { value: player });
      return event;
    };
    for (const type of ['mousedown', 'click', 'keydown']) expect(nodeView.stopEvent!(on(type)), type).toBe(true);
    // Anywhere else on the block (its caption), the editor selects it as usual.
    const elsewhere = new MouseEvent('mousedown');
    Object.defineProperty(elsewhere, 'target', { value: nodeView.dom!.querySelector('figcaption') });
    expect(nodeView.stopEvent!(elsewhere)).toBe(false);
    for (const type of ['attributes', 'childList'] as const) {
      expect(nodeView.ignoreMutation!({ type, target: player } as unknown as MutationRecord), type).toBe(true);
    }
  });

  it('says so when the file is there but cannot play here', async () => {
    const { host } = open('![Demo](.bava/attachments/demo.mov)\n', ['.bava/attachments/demo.mov']);
    const figure = host.querySelector('figure.media')!;
    figure.querySelector('video')!.dispatchEvent(new Event('error'));
    await settle();
    await settle();
    expect(figure.getAttribute('data-state')).toBe('unplayable');
    expect(figure.textContent).toContain("This video can't play here");
  });
});

describe('an online video in the page', () => {
  const page = '<!-- bava: caption="Demo" -->\n![Launch demo](https://www.youtube.com/watch?v=abc123)\n';

  it("shows the video's picture as the page opens, and loads no player until play", async () => {
    const { host, probeFile } = open(page);
    const figure = host.querySelector('figure.media')!;
    expect(figure.getAttribute('data-kind')).toBe('online');
    expect(figure.getAttribute('data-ratio')).toBe('16:9');
    expect(figure.textContent).toContain('YouTube');
    expect(figure.querySelector('iframe, video')).toBeNull();
    expect(figure.querySelector<HTMLImageElement>('img.media-thumbnail')!.getAttribute('src')).toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg');
    await settle();
    expect(probeFile).not.toHaveBeenCalled();
  });

  it('shows the placeholder alone when the picture cannot load, as offline', () => {
    const { host } = open(page);
    const figure = host.querySelector('figure.media')!;
    figure.querySelector('img.media-thumbnail')!.dispatchEvent(new Event('error'));
    expect(figure.querySelector('img.media-thumbnail')).toBeNull();
    expect(figure.textContent).toContain('YouTube');
  });

  it("puts the site's player in its place when play is pressed, playing at once", () => {
    const { host } = open(page);
    const figure = host.querySelector('figure.media')!;
    figure.querySelector<HTMLButtonElement>('button.media-play')!.click();
    const frame = figure.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abc123?autoplay=1');
    expect(frame.getAttribute('allow')).toContain('autoplay');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin allow-presentation allow-popups');
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(frame.getAttribute('title')).toBe('Launch demo');
  });

  it('keeps its player while the page is edited and its settings change', () => {
    const { host, view } = open(`Before\n\n${page}`);
    host.querySelector<HTMLButtonElement>('button.media-play')!.click();
    const frame = host.querySelector('iframe');
    view.dispatch(view.state.tr.insertText('typed ', 1));
    let at = -1;
    view.state.doc.forEach((node, offset) => {
      if (node.type.name === 'video') at = offset;
    });
    view.dispatch(view.state.tr.setNodeMarkup(at, null, { ...view.state.doc.nodeAt(at)!.attrs, width: 'small' }));
    expect(host.querySelector('iframe')).toBe(frame);
  });

  it('opens in the browser instead, from a site that will not play inside Bava', () => {
    const onOpenFile = vi.fn();
    const opened = openEditor(page, { onOpenFile, playsInPage: () => false });
    editor = opened.editor;
    const { host } = opened;
    host.querySelector<HTMLButtonElement>('button.media-play')!.click();
    expect(host.querySelector('iframe')).toBeNull();
    expect(onOpenFile).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc123');
  });
});
