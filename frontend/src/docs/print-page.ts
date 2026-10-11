/**
 * A page drawn for printing: its Markdown in an editor of its own, out of
 * sight and read-only, so equations, code, tables and callouts print exactly
 * as they look; then a copy of what it drew, without its controls, and the
 * styles it is drawn with. The editor is taken down afterwards, always.
 */
import { DocEditor, type DocEditorOptions } from './editor';
import type { MediaPlace } from './media';
import type { PageWidth } from './page-settings';

/** A page as printed: its HTML, and its width in Bava (0 for full width). */
export type PrintedPage = { html: string; widthPx: number };

export type RenderOptions = {
  /** Where the page sits, for its pictures. */
  place: MediaPlace;
  /** The width the page is shown at, or how to tell from its own setting. */
  width: PageWidth | ((own: PageWidth | undefined) => PageWidth);
  /** Canvas embeds, drawn as the open page draws them. */
  embeds?: DocEditorOptions['embeds'];
  /** Waits for what the page draws later (pictures); by default, its pictures. */
  ready?: (host: HTMLElement) => Promise<void>;
};

/** The out-of-sight element the page is drawn in, for `print.scss`. */
export const PRINT_HOST_CLASS = 'bava-print-host';

/** The class the printed page's root carries, for `print.scss`. */
export const PRINT_CLASS = 'bava-print';

/** The page widths' token values, should the tokens not be read. */
const FALLBACK_WIDTH_PX = { narrow: 640, wide: 760 } as const;

/** The width a full-width page is drawn at before printing fits it to the paper. */
const FULL_WIDTH_DRAWN_PX = 1000;

/** How long a picture is waited for before the page prints without it. */
const PICTURE_WAIT_MS = 10_000;

/** The page's width in CSS pixels, from its token; 0 for full width. */
function widthPx(width: PageWidth): number {
  if (width === 'full') return 0;
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(`--size-page-${width}`));
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_WIDTH_PX[width];
}

/** Waits for every picture the page shows to load or fail, for a while. */
async function picturesLoaded(host: HTMLElement): Promise<void> {
  // A turn first: embeds and cards set their pictures after they are drawn.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const pictures = [...host.querySelectorAll('img')].filter((img) => !img.complete);
  const loaded = Promise.all(
    pictures.map((img) => new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    })),
  );
  await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, PICTURE_WAIT_MS))]);
}

/** Draws a page's Markdown for printing. */
export async function renderPage(markdown: string, options: RenderOptions): Promise<PrintedPage> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.className = PRINT_HOST_CLASS;
  document.body.append(host);
  const editor = new DocEditor();
  try {
    editor.mount(host, { onChange: () => {}, embeds: options.embeds });
    editor.setMediaPlace(options.place);
    editor.setPage(markdown);
    const width = typeof options.width === 'function' ? options.width(editor.settings.width as PageWidth | undefined) : options.width;
    const px = widthPx(width);
    host.style.width = `${px || FULL_WIDTH_DRAWN_PX}px`;
    editor.view?.setProps({ editable: () => false });
    await (options.ready ?? picturesLoaded)(host);
    const dom = editor.view?.dom;
    if (!dom) throw new Error('the page could not be drawn');
    const clone = printableClone(dom);
    return { html: `<div class="${PRINT_CLASS}">${clone.outerHTML}</div>`, widthPx: px };
  } finally {
    editor.destroy();
    host.remove();
  }
}

/** Is an address one the printing webview could not reach: anything on the web. */
const onTheWeb = (src: string) => /^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith('data:');

/**
 * A copy of the page's drawing fit to print: no buttons, players or bars,
 * nothing editable or selected; a picture from the web as its address, a
 * video file as its name.
 */
export function printableClone(root: HTMLElement): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement;
  for (const el of clone.querySelectorAll('button, iframe, canvas, .code-bar, .media-notice, .embed-deleted')) el.remove();
  for (const video of clone.querySelectorAll('video')) {
    const file = document.createElement('div');
    file.className = 'media-print-file';
    const src = video.getAttribute('src') ?? '';
    const path = new URL(src, 'http://bava.invalid').searchParams.get('path') ?? src;
    file.textContent = decodeURIComponent(path.split('#')[0].split('/').pop() ?? '');
    video.replaceWith(file);
  }
  for (const img of clone.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? '';
    if (!onTheWeb(src)) continue;
    // Its own picture as an address; a thumbnail or an icon beside words that say it already, dropped.
    if (img.classList.contains('media-file')) {
      const link = document.createElement('a');
      link.className = 'media-print-link';
      link.href = src;
      link.textContent = src;
      img.replaceWith(link);
    } else img.remove();
  }
  for (const el of [clone, ...clone.querySelectorAll('*')]) {
    el.removeAttribute('contenteditable');
    el.removeAttribute('draggable');
    el.removeAttribute('spellcheck');
    el.classList.remove('ProseMirror-selectednode', 'ProseMirror-focused');
  }
  return clone;
}

/** The styles the app draws with, as text, for the printed page to carry. */
export function pageCss(): string {
  return [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');
}
