/**
 * Cards in the page: a file of the Space, or a page on the web, shown as a
 * box that opens it. A file card reads its size, type and date from the file;
 * a web card shows what was saved when it was made (its pictures are
 * attachments), so drawing one asks the web for nothing. Drawn once, and
 * changed in place.
 */
import type { Node } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';
import { t } from '../i18n/t';
import { formatBytes } from '../files/space-helpers';
import { formatDay } from './dates';
import { resolveLink } from './links';
import { isWeb, mediaRelinkAddress, type MediaPlace } from './media';

const ATTACHMENTS = '.bava/attachments/';

export type FileLook = { icon: 'file' | 'text' | 'sheet' | 'archive' | 'code' | 'slides' | 'image'; type: string };

const ICONS: Record<string, FileLook['icon']> = {
  pdf: 'text', doc: 'text', docx: 'text', txt: 'text', rtf: 'text', md: 'text', pages: 'text', odt: 'text',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet', numbers: 'sheet', ods: 'sheet', tsv: 'sheet',
  zip: 'archive', gz: 'archive', tar: 'archive', tgz: 'archive', '7z': 'archive', rar: 'archive',
  ppt: 'slides', pptx: 'slides', key: 'slides', odp: 'slides',
  go: 'code', ts: 'code', js: 'code', py: 'code', json: 'code', yaml: 'code', yml: 'code', html: 'code', css: 'code', d2: 'code', sh: 'code',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', heic: 'image', tiff: 'image',
};

/** A file's icon and its type (its extension, in capitals), by its name. */
export function fileLook(name: string): FileLook {
  const base = name.slice(name.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
  return { icon: ICONS[ext] ?? 'file', type: ext.toUpperCase() };
}

/** A picture saved with a web card, by its name in the attachments; null for anything but a plain name. */
function savedPicture(place: MediaPlace | null, name: string | null): string | null {
  if (!place || !name || /[/\\]/.test(name) || name.startsWith('.')) return null;
  return `/bava-file/?${new URLSearchParams({ root: place.root, path: ATTACHMENTS + name })}`;
}

function decodeName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export type FileDetails = { exists: boolean; size: number; modified: string; error: string };

export type CardContext = {
  place: () => MediaPlace | null;
  /** A file's details, by the folder the user opened and its path there. */
  details: (root: string, path: string) => Promise<FileDetails>;
  /** Opens what a card reaches: its address as written in the page. */
  open: (href: string) => void;
  watchPlace: (redraw: () => void) => () => void;
  relink: (pos: number, href: string) => void;
};

/** A card, drawn once and changed in place. */
export function cardView(node: Node, view: EditorView, getPos: () => number | undefined, context: CardContext): NodeView {
  const dom = document.createElement('div');
  dom.className = 'card';
  dom.contentEditable = 'false';
  const icon = document.createElement('span');
  icon.className = 'card-icon';
  const body = document.createElement('div');
  body.className = 'card-body';
  const title = document.createElement('div');
  title.className = 'card-title';
  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const description = document.createElement('div');
  description.className = 'card-description';
  const notice = document.createElement('div');
  notice.className = 'card-notice';
  body.append(title, meta, description, notice);
  const picture = document.createElement('img');
  picture.className = 'card-picture';
  picture.alt = '';
  dom.append(icon, body);

  let current = node;
  /** Each read of a file is numbered, so one that answers late is dropped. */
  let read = 0;

  const web = () => isWeb(current.attrs.href as string);

  const drawIcon = () => {
    icon.replaceChildren();
    const saved = web() ? savedPicture(context.place(), current.attrs.icon) : null;
    if (saved) {
      const img = document.createElement('img');
      img.src = saved;
      img.alt = '';
      // A saved icon that will not load gives way to the web's own.
      img.addEventListener('error', () => {
        img.remove();
        icon.dataset.icon = 'web';
      });
      icon.append(img);
      icon.dataset.icon = 'saved';
    } else icon.dataset.icon = web() ? 'web' : fileLook(decodeName(current.attrs.href as string)).icon;
  };

  const drawWeb = () => {
    let host = '';
    try {
      host = new URL(current.attrs.href as string).hostname.replace(/^www\./, '');
    } catch {
      // An address that is not one shows no domain.
    }
    meta.textContent = host;
    const extended = current.attrs.look === 'extended';
    description.textContent = extended ? ((current.attrs.description as string | null) ?? '') : '';
    description.hidden = !description.textContent;
    const saved = extended ? savedPicture(context.place(), current.attrs.image) : null;
    if (saved) {
      if (picture.getAttribute('src') !== saved) picture.src = saved;
      if (!picture.isConnected) dom.append(picture);
    } else picture.remove();
    dom.dataset.state = 'ready';
    notice.replaceChildren();
  };

  const drawFile = () => {
    description.hidden = true;
    picture.remove();
    const place = context.place();
    const target = place ? resolveLink(place.here, current.attrs.href as string)?.target : undefined;
    const asked = (read += 1);
    if (!place || !target) {
      missing(null);
      return;
    }
    void context.details(place.root, target).then(async (file) => {
      if (asked !== read) return;
      if (file.exists) {
        const look = fileLook(target);
        const parts = current.attrs.look === 'extended' ? [look.type, formatBytes(file.size), formatDay(file.modified.slice(0, 10))] : [formatBytes(file.size)];
        meta.textContent = parts.filter(Boolean).join(' · ');
        dom.dataset.state = 'ready';
        notice.replaceChildren();
        return;
      }
      const address = mediaRelinkAddress(place, current.attrs.href as string);
      const candidate = address ? resolveLink(place.here, address)?.target : undefined;
      const there = candidate ? (await context.details(place.root, candidate)).exists : false;
      if (asked === read) missing(there ? address : null);
    });
  };

  const missing = (relinkTo: string | null) => {
    dom.dataset.state = 'missing';
    meta.textContent = '';
    notice.replaceChildren();
    const words = document.createElement('span');
    const name = (current.attrs.href as string).slice((current.attrs.href as string).lastIndexOf('/') + 1);
    words.textContent = t('media.missing').replace('{name}', decodeName(name));
    notice.append(words);
    if (!relinkTo) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-relink';
    button.textContent = t('media.relink').replace('{name}', decodeName(relinkTo.slice(relinkTo.lastIndexOf('/') + 1)));
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const pos = getPos();
      if (pos !== undefined && view.editable) context.relink(pos, relinkTo);
    });
    notice.append(button);
  };

  const draw = (whole: boolean) => {
    dom.dataset.kind = web() ? 'web' : 'file';
    dom.dataset.look = current.attrs.look;
    title.textContent = current.attrs.text as string;
    dom.title = current.attrs.href as string;
    drawIcon();
    if (web()) drawWeb();
    else if (whole) drawFile();
  };

  // A click opens what the card reaches.
  dom.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('button')) return;
    context.open(current.attrs.href as string);
  });

  draw(true);
  const stopWatching = context.watchPlace(() => draw(true));

  return {
    dom,
    update(next) {
      if (next.type !== current.type) return false;
      const reread = next.attrs.href !== current.attrs.href || next.attrs.look !== current.attrs.look;
      current = next;
      draw(reread);
      return true;
    },
    selectNode() {
      dom.classList.add('ProseMirror-selectednode');
    },
    deselectNode() {
      dom.classList.remove('ProseMirror-selectednode');
    },
    // A click opens the card, and its relink button is its own.
    stopEvent: (event) => event.type === 'click' || (event.target instanceof Element && event.target.closest('button') !== null),
    ignoreMutation: () => true,
    destroy() {
      stopWatching();
      read += 1;
    },
  };
}
