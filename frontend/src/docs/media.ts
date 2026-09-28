/**
 * Images and videos in the page: drawn from the app's file route, sized,
 * cropped, aligned and captioned from the block's settings. Each block is
 * drawn once; a change to its settings changes what is drawn in place, so a
 * video that is playing keeps playing while the page is edited elsewhere.
 * The player's own clicks, keys and changes to its elements stay the
 * player's.
 */
import type { Node } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';
import { t } from '../i18n/t';
import { linkTo, resolveLink } from './links';
import { mediaKind } from './markdown';
import { onlineVideo, type OnlineVideo } from './online-video';
import { schema } from './schema';

/** The folder the user opened (a Space, or a loose page's folder) and this page's path in it. */
export type MediaPlace = { root: string; here: string };

const ATTACHMENTS = '.bava/attachments/';

/** A transaction's meta asking the app for files to add ('image', 'video' or any 'file'). */
export const MEDIA_PICKER = 'bava-media-picker';

/** A transaction's meta asking the app for a web address to put in ('weblink' or 'onlinevideo'). */
export const ADDRESS_ASK = 'bava-address-ask';

/** Whether a media block's file is on the web. */
export const isWeb = (src: string) => /^https?:\/\//i.test(src);

/**
 * Where the page loads a media block's file: its own address on the web,
 * else the app's file route; null when its address leaves the opened folder.
 */
export function mediaUrl(place: MediaPlace | null, src: string): string | null {
  if (isWeb(src)) return src;
  const reached = place ? resolveLink(place.here, src) : null;
  if (!place || !reached) return null;
  return `/bava-file/?${new URLSearchParams({ root: place.root, path: reached.target })}`;
}

/** A poster's file, by its name in the attachments folder. */
function posterUrl(place: MediaPlace | null, name: string | null): string | null {
  return place && name ? `/bava-file/?${new URLSearchParams({ root: place.root, path: ATTACHMENTS + name })}` : null;
}

/** The address of the file with this one's name in the attachments folder, when that is another file. */
export function mediaRelinkAddress(place: MediaPlace, src: string): string | null {
  const reached = resolveLink(place.here, src);
  const name = reached?.target.slice(reached.target.lastIndexOf('/') + 1);
  if (!reached || !name || reached.target === ATTACHMENTS + name) return null;
  return linkTo(place.here, ATTACHMENTS + name, '');
}

/**
 * A new block for an attachment, reached from `here`: an image or a video,
 * its words the file's name without its type; any other file, a card.
 */
export function attachmentBlock(here: string, name: string): Node {
  const kind = mediaKind(name);
  if (!kind) return schema.nodes.card.create({ href: linkTo(here, ATTACHMENTS + name, ''), text: name });
  const dot = name.lastIndexOf('.');
  return schema.nodes[kind].create({ src: linkTo(here, ATTACHMENTS + name, ''), alt: dot > 0 ? name.slice(0, dot) : name });
}

/** The frame a video shows now, as a PNG in base64; null before it has one. */
export function videoFrame(video: HTMLVideoElement): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(video, 0, 0);
  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

/** Whether the file route has a file: asked with HEAD, which reads nothing. */
export async function probeFile(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
}

export type MediaContext = {
  place: () => MediaPlace | null;
  probe: (url: string) => Promise<boolean>;
  /** Called with a function that draws the block again, when the opened folder changes; returns how to stop. */
  watchPlace: (redraw: () => void) => () => void;
  /** Points the block at `pos` at a new address, as one edit. */
  relink: (pos: number, src: string) => void;
  /** Whether a site's videos play inside Bava's window; one that does not opens in the browser. */
  playsInPage?: (provider: OnlineVideo['provider']) => boolean;
  /** Opens an address in the browser. */
  openExternal?: (href: string) => void;
};

type State = 'loading' | 'ready' | 'missing' | 'unplayable';

/**
 * An online video: a placeholder that contacts no one until play is
 * pressed, then the site's player in its place, kept while the page is
 * edited. From a site that will not play inside Bava, play opens the browser.
 */
function onlineView(node: Node, online: OnlineVideo, context: MediaContext): NodeView {
  const dom = document.createElement('figure');
  dom.className = 'media';
  dom.dataset.kind = 'online';
  dom.dataset.state = 'ready';
  dom.contentEditable = 'false';
  const frame = document.createElement('div');
  frame.className = 'media-frame';
  const placeholder = document.createElement('div');
  placeholder.className = 'media-online';
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'media-play';
  play.setAttribute('aria-label', t('media.play').replace('{site}', online.provider));
  const site = document.createElement('span');
  site.className = 'media-site';
  site.textContent = online.provider;
  const address = document.createElement('span');
  address.className = 'media-address';
  address.textContent = node.attrs.src as string;
  placeholder.append(play, site, address);
  frame.append(placeholder);
  const caption = document.createElement('figcaption');
  caption.className = 'media-caption';
  dom.append(frame, caption);

  let current = node;
  const drawSettings = () => {
    const a = current.attrs;
    for (const key of ['width', 'align'] as const) {
      if (a[key]) dom.dataset[key] = a[key];
      else delete dom.dataset[key];
    }
    // Its own shape is unknown until it plays: 16:9 unless set.
    dom.dataset.ratio = a.ratio ?? '16:9';
    caption.textContent = a.caption ?? '';
    caption.hidden = !a.caption;
  };

  play.addEventListener('click', () => {
    if (context.playsInPage?.(online.provider) === false) {
      context.openExternal?.(current.attrs.src as string);
      return;
    }
    const player = document.createElement('iframe');
    player.className = 'media-file media-player';
    player.src = online.player;
    player.title = (current.attrs.alt as string) || online.provider;
    player.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
    player.setAttribute('allowfullscreen', '');
    player.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    player.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups');
    placeholder.replaceWith(player);
  });

  drawSettings();
  return {
    dom,
    update(next) {
      if (next.type !== current.type || next.attrs.src !== current.attrs.src) return false;
      current = next;
      drawSettings();
      return true;
    },
    selectNode() {
      dom.classList.add('ProseMirror-selectednode');
    },
    deselectNode() {
      dom.classList.remove('ProseMirror-selectednode');
    },
    stopEvent: (event) => event.target instanceof Element && event.target.closest('button, iframe') !== null,
    ignoreMutation: () => true,
  };
}

/** An image or a video block, drawn once and changed in place. */
export function mediaView(node: Node, view: EditorView, getPos: () => number | undefined, context: MediaContext): NodeView {
  const online = node.type === schema.nodes.video ? onlineVideo(node.attrs.src as string) : null;
  if (online) return onlineView(node, online, context);
  const video = node.type === schema.nodes.video;
  const dom = document.createElement('figure');
  dom.className = 'media';
  dom.dataset.kind = video ? 'video' : 'image';
  dom.contentEditable = 'false';
  const frame = document.createElement('div');
  frame.className = 'media-frame';
  const player = document.createElement(video ? 'video' : 'img') as HTMLImageElement | HTMLVideoElement;
  player.className = 'media-file';
  player.draggable = false;
  if (player instanceof HTMLVideoElement) {
    // The webview's own player; nothing plays until play is pressed.
    player.controls = true;
    player.preload = 'metadata';
    player.autoplay = false;
    player.playsInline = true;
  }
  const notice = document.createElement('div');
  notice.className = 'media-notice';
  frame.append(player, notice);
  const caption = document.createElement('figcaption');
  caption.className = 'media-caption';
  dom.append(frame, caption);

  let current = node;
  let src: string | null = null;
  /** Each load is numbered, so a probe that answers late is dropped. */
  let load = 0;

  const setState = (state: State, relinkTo: string | null = null) => {
    dom.dataset.state = state;
    notice.replaceChildren();
    if (state === 'loading' || state === 'ready') return;
    const name = current.attrs.src.slice(current.attrs.src.lastIndexOf('/') + 1);
    const words = document.createElement('span');
    const missing = isWeb(current.attrs.src) ? t('media.unreachable') : t('media.missing');
    words.textContent = state === 'missing' ? missing.replace('{name}', decodeName(name)) : t('media.unplayable');
    notice.append(words);
    if (relinkTo) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'media-relink';
      button.textContent = t('media.relink').replace('{name}', decodeName(relinkTo.slice(relinkTo.lastIndexOf('/') + 1)));
      button.addEventListener('click', () => {
        const pos = getPos();
        if (pos !== undefined && view.editable) context.relink(pos, relinkTo);
      });
      notice.append(button);
    }
  };

  /** Draws the file, when its address or the opened folder changed. */
  const drawFile = () => {
    const place = context.place();
    const next = mediaUrl(place, current.attrs.src);
    load += 1;
    if (next === src && next !== null) return;
    src = next;
    setState('loading');
    if (next === null) {
      player.removeAttribute('src');
      setState('missing');
      return;
    }
    // A video on the web loads nothing until play is pressed.
    if (player instanceof HTMLVideoElement) player.preload = isWeb(current.attrs.src) ? 'none' : 'metadata';
    player.src = next;
  };

  const drawPoster = () => {
    if (!(player instanceof HTMLVideoElement)) return;
    const poster = posterUrl(context.place(), current.attrs.poster);
    if (poster) player.poster = poster;
    else player.removeAttribute('poster');
  };

  /** Every setting, drawn onto the same elements. */
  const drawSettings = () => {
    const a = current.attrs;
    for (const key of ['width', 'ratio', 'align'] as const) {
      if (a[key]) dom.dataset[key] = a[key];
      else delete dom.dataset[key];
    }
    if (player instanceof HTMLImageElement) player.alt = a.alt;
    else {
      player.loop = a.loop;
      player.muted = a.muted;
      player.setAttribute('aria-label', a.alt);
    }
    caption.textContent = a.caption ?? '';
    caption.hidden = !a.caption;
  };

  // Loaded: the file is there and shown (a video once its player knows it).
  player.addEventListener(video ? 'loadedmetadata' : 'load', () => setState('ready'));
  // Not loaded: missing, or there and not something this webview can show.
  player.addEventListener('error', () => {
    const asked = load;
    // On the web, nothing more is asked: it could not be loaded.
    if (isWeb(current.attrs.src)) {
      setState('missing');
      return;
    }
    const place = context.place();
    if (!src || !place) return;
    void context.probe(src).then(async (there) => {
      if (asked !== load) return;
      if (there) {
        setState(video ? 'unplayable' : 'missing');
        return;
      }
      const address = mediaRelinkAddress(place, current.attrs.src);
      const candidate = address ? mediaUrl(place, address) : null;
      const offer = candidate && (await context.probe(candidate)) ? address : null;
      if (asked === load) setState('missing', offer);
    });
  });

  drawSettings();
  drawPoster();
  drawFile();
  const stopWatching = context.watchPlace(() => {
    src = null;
    drawFile();
    drawPoster();
  });

  return {
    dom,
    update(next) {
      // A file becoming an online video is drawn again, as one.
      if (next.type !== current.type || (video && onlineVideo(next.attrs.src as string))) return false;
      const moved = next.attrs.src !== current.attrs.src;
      const posterChanged = next.attrs.poster !== current.attrs.poster;
      current = next;
      drawSettings();
      if (moved) drawFile();
      if (posterChanged) drawPoster();
      return true;
    },
    selectNode() {
      dom.classList.add('ProseMirror-selectednode');
    },
    deselectNode() {
      dom.classList.remove('ProseMirror-selectednode');
    },
    // The player's own clicks and keys, and the relink button's, are theirs.
    stopEvent(event) {
      const target = event.target;
      if (!(target instanceof Element)) return false;
      if (target.closest('button')) return true;
      return video && target === player;
    },
    // Nothing the player or a load does to these elements is an edit.
    ignoreMutation: () => true,
    destroy() {
      stopWatching();
      if (player instanceof HTMLVideoElement && !player.paused) player.pause();
    },
  };
}

function decodeName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
