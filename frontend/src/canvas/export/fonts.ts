/**
 * The font an exported SVG carries.
 *
 * An export is a file the user will send somewhere else, so the lettering has
 * to travel with it: the SVG embeds the same Geist the app bundles, read from
 * the app's own assets. Nothing is fetched from a network, here or when the
 * file is later opened (a non-negotiable, not a preference).
 *
 * The file is about 68KB, near 93KB once base64 encoded, so it is embedded
 * only when the export actually has lettering.
 */
import type { SceneElement } from '../scene';

/** The bundled variable fonts, served by the app itself. */
export const FONT_FILE = '/fonts/Geist-Variable.woff2';
export const MONO_FONT_FILE = '/fonts/GeistMono-Variable.woff2';

export type FontOptions = {
  /** The font stack the SVG's text elements carry, or a single family. */
  family: string;
  /** Reads the font bytes. Injected, so a test never touches the bundle. */
  read?: () => Promise<ArrayBuffer>;
  /** The mono stack, when the export holds a code block. */
  monoFamily?: string;
  readMono?: () => Promise<ArrayBuffer>;
};

/** Whether the export holds a code block, which draws in the mono face. */
export function carriesCode(elements: SceneElement[]): boolean {
  return elements.some((element) => element.type === 'code');
}

/** Whether anything in the export draws lettering. */
export function carriesText(elements: SceneElement[]): boolean {
  return elements.some((element) => {
    const text = element.type === 'text' ? (element as { text?: string }).text : undefined;
    const label = 'label' in element ? (element as { label?: string }).label : undefined;
    return Boolean(text?.trim()) || Boolean(label?.trim());
  });
}

/**
 * The family an `@font-face` is named after, taken from a stack.
 *
 * `--font-ui` is `'Geist', system-ui, sans-serif`. A face named after the whole
 * stack matches nothing, so the bytes travel and the text still renders in a
 * fallback: the embed silently does nothing.
 */
export function faceFamily(stack: string): string {
  const first = stack.split(',')[0]?.trim() ?? '';
  return first.replace(/^['"]|['"]$/g, '').trim();
}

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // In chunks: a spread of a 68KB array overflows the call stack in WebKit.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function readFromBundle(file: string): Promise<ArrayBuffer> {
  const response = await fetch(file);
  if (!response.ok) throw new Error(`export: the bundled font is missing (${response.status})`);
  return response.arrayBuffer();
}

/**
 * A `<style>` body embedding the font, or '' when the export has no lettering
 * or the font cannot be read. An export without the font is still a valid
 * picture: its text names the family, and a reader that has Geist uses it.
 */
export async function fontCss(elements: SceneElement[], options: FontOptions): Promise<string> {
  const faces: string[] = [];
  if (carriesText(elements)) faces.push(await face(options.family, options.read ?? (() => readFromBundle(FONT_FILE))));
  // A code block is drawn at absolute x by mono advance, so a viewer without
  // the mono face would see every column out of line.
  if (carriesCode(elements) && options.monoFamily) {
    faces.push(await face(options.monoFamily, options.readMono ?? (() => readFromBundle(MONO_FONT_FILE))));
  }
  return faces.filter(Boolean).join(' ');
}

/** One `@font-face`, or '' when the family or the bytes are unavailable. */
async function face(stack: string, read: () => Promise<ArrayBuffer>): Promise<string> {
  try {
    const family = faceFamily(stack);
    if (!family) return '';
    const buffer = await read();
    return (
      `@font-face { font-family: '${family}';` +
      ` src: url(data:font/woff2;base64,${base64(buffer)}) format('woff2'); }`
    );
  } catch {
    return '';
  }
}
