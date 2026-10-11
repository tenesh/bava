/**
 * A PDF's first sheet for the export dialog's preview: the sheet's size in
 * CSS pixels and a document drawing it, the page laid out as it prints (its
 * width fitted between the margins) or the Canvas's picture fitted to the
 * sheet when it alone is printed.
 */
import { paperSize, type Include, type PageSetup } from './export-pdf';

/** CSS pixels to the millimetre. */
const PX_PER_MM = 96 / 25.4;

export type PreviewInput = {
  page: { html: string; css: string; widthPx: number } | null;
  canvas: { svg: string; width: number; height: number } | null;
  include: Include;
  setup: PageSetup;
  dark: boolean;
};

/** The first sheet: its size in CSS pixels and its document; null for a paper with no size. */
export function firstSheet({ page, canvas, include, setup, dark }: PreviewInput): { width: number; height: number; srcdoc: string } | null {
  const canvasFirst = include === 'canvas' && canvas !== null;
  const landscape = canvasFirst && canvas ? canvas.width > canvas.height : setup.landscape;
  const size = paperSize({ ...setup, landscape });
  if (!size) return null;
  const width = size.width * PX_PER_MM;
  const height = size.height * PX_PER_MM;
  const m = setup.margins;
  const roomWidth = width - (m.left + m.right) * PX_PER_MM;
  const roomHeight = height - (m.top + m.bottom) * PX_PER_MM;
  let body = '';
  let fit = '';
  if (canvasFirst && canvas) {
    const scale = Math.min(1, roomWidth / canvas.width, roomHeight / canvas.height);
    body = `<img alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(canvas.svg)}">`;
    fit = `img { display: block; margin: 0 auto; width: ${canvas.width * scale}px; height: ${canvas.height * scale}px; }`;
  } else if (page) {
    body = page.html;
    if (page.widthPx > 0) fit = `.bava-print { width: ${page.widthPx}px; zoom: ${roomWidth / page.widthPx}; }`;
  }
  const srcdoc =
    `<!doctype html><html data-theme="${dark ? 'dark' : 'light'}"><head><meta charset="utf-8">` +
    `<style>${page?.css ?? ''}</style>` +
    `<style>html, body { height: auto !important; overflow: hidden !important; } ` +
    `body { box-sizing: border-box; margin: 0; padding: ${m.top}mm ${m.right}mm 0 ${m.left}mm; } ${fit}</style>` +
    `</head><body>${body}</body></html>`;
  return { width, height, srcdoc };
}
