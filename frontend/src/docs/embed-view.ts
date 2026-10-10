/**
 * A canvas embed in the page: a frame drawn as a picture. This page's frame
 * is drawn live from its canvas, again 250ms after the canvas settles;
 * another page's is shown from its picture file. A frame that is gone keeps
 * its last picture, marked deleted, and goes live again when it is back. A
 * click asks for the frame to be opened on its canvas.
 */
import type { Node } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';
import { t } from '../i18n/t';
import { mediaUrl, type MediaContext } from './media';
import { PICTURE_SCALE } from '../canvas/export/frame-picture';
import { resolveLink } from './links';

/** How long the canvas has to stay still before this page's embeds are drawn again. */
export const EMBED_REDRAW_MS = 250;

export type EmbedContext = MediaContext & {
  /**
   * This page's frame drawn now, in the current theme, as an image address;
   * null when the canvas holds no such frame. Without it, there is no canvas
   * to draw from, and every embed shows its picture file.
   */
  draw?: (frame: string) => Promise<string | null>;
  /** Called whenever this page's canvas changes; returns how to stop. */
  watchCanvas: (changed: () => void) => () => void;
  /** Whether another page's canvas still holds the frame; null when that page cannot be read. */
  holds: (page: string, frame: string) => Promise<boolean | null>;
  /** Opens the frame on its canvas: this page's (`page` null) or another's. */
  open: (frame: string, page: string | null) => void;
};

export function embedView(node: Node, _view: EditorView, _getPos: () => number | undefined, context: EmbedContext): NodeView {
  const dom = document.createElement('figure');
  dom.className = 'media embed';
  dom.dataset.kind = 'embed';
  dom.contentEditable = 'false';
  const frame = document.createElement('div');
  frame.className = 'media-frame';
  const picture = document.createElement('img');
  picture.className = 'media-file';
  // The picture is drawn at twice the frame's size, for sharp screens: shown
  // at half its pixels, it is the frame's own size, as on the canvas.
  picture.addEventListener('load', () => {
    if (picture.naturalWidth > 0) dom.style.setProperty('--embed-width', `${picture.naturalWidth / PICTURE_SCALE}px`);
  });
  picture.draggable = false;
  const deleted = document.createElement('span');
  deleted.className = 'embed-deleted';
  deleted.textContent = t('embed.deleted');
  frame.append(picture, deleted);
  const caption = document.createElement('figcaption');
  caption.className = 'media-caption';
  dom.append(frame, caption);

  let current = node;
  /** Each drawing is numbered, so one that answers late is dropped. */
  let drawing = 0;
  let settle: ReturnType<typeof setTimeout> | undefined;
  let live: string | null = null;

  const setDeleted = (gone: boolean) => {
    if (gone) dom.dataset.deleted = '';
    else delete dom.dataset.deleted;
  };

  const showFile = () => {
    const url = mediaUrl(context.place(), current.attrs.src as string);
    if (url) picture.src = url;
    else picture.removeAttribute('src');
  };

  const forget = () => {
    if (live?.startsWith('blob:')) URL.revokeObjectURL(live);
    live = null;
  };

  /** The frame's page by its path in the Space, as written resolved from this page; null for this page. */
  const pageOf = (): string | null => {
    const written = current.attrs.page as string | null;
    if (written === null) return null;
    return resolveLink(context.place()?.here ?? '', written)?.target ?? written;
  };

  /** This page's frame live, or its last picture marked deleted; another page's from its file. */
  const draw = async () => {
    const asked = (drawing += 1);
    const page = pageOf();
    if (!context.draw) {
      showFile();
      return;
    }
    if (page !== null) {
      forget();
      showFile();
      const holds = await context.holds(page, current.attrs.frame as string);
      if (asked === drawing) setDeleted(holds === false);
      return;
    }
    const url = await context.draw(current.attrs.frame as string);
    if (asked !== drawing) {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      return;
    }
    forget();
    if (url === null) {
      showFile();
      setDeleted(true);
      return;
    }
    live = url;
    picture.src = url;
    setDeleted(false);
  };

  const drawSettings = () => {
    const a = current.attrs;
    for (const key of ['width', 'align'] as const) {
      if (a[key]) dom.dataset[key] = a[key];
      else delete dom.dataset[key];
    }
    picture.alt = a.alt as string;
    caption.textContent = (a.caption as string | null) ?? '';
    caption.hidden = !a.caption;
  };

  const stopCanvas = context.watchCanvas(() => {
    if (current.attrs.page !== null) return;
    clearTimeout(settle);
    settle = setTimeout(() => void draw(), EMBED_REDRAW_MS);
  });
  const stopPlace = context.watchPlace(() => void draw());
  dom.addEventListener('click', () => context.open(current.attrs.frame as string, pageOf()));

  drawSettings();
  void draw();

  return {
    dom,
    update(next) {
      if (next.type !== current.type) return false;
      const moved = ['frame', 'page', 'src'].some((key) => next.attrs[key] !== current.attrs[key]);
      current = next;
      drawSettings();
      if (moved) void draw();
      return true;
    },
    selectNode() {
      dom.classList.add('ProseMirror-selectednode');
    },
    deselectNode() {
      dom.classList.remove('ProseMirror-selectednode');
    },
    // Nothing a drawing does to these elements is an edit.
    ignoreMutation: () => true,
    destroy() {
      // A drawing still on its way is dropped, its picture freed.
      drawing += 1;
      clearTimeout(settle);
      stopCanvas();
      stopPlace();
      forget();
    },
  };
}
