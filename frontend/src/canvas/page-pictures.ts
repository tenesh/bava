/**
 * The pictures a page's canvas shows, read from the page's file, and a
 * renamed picture rewritten there. The canvas is the page's `bava-canvas`
 * block (`docs/file-format.md`), read here only for its picture elements.
 */

/**
 * The canvas block's JSON in a page's text, and where it sits; null without
 * one. Found as the app's reader finds it (`internal/format/scan.go`): a
 * fence closes at the first fence at least as long, a fence inside another is
 * the outer one's text, and of several canvas blocks the last is the canvas.
 */
function canvasBlock(text: string): { body: string; start: number; end: number } | null {
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const offsets: number[] = [];
  lines.reduce((at, line) => (offsets.push(at), at + line.length), 0);
  let found: { body: string; start: number; end: number } | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const opening = /^[ \t]*(`{3,})([^`]*?)\r?\n?$/.exec(lines[i]);
    if (!opening) continue;
    const fence = opening[1];
    let close = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      const trimmed = lines[j].trim();
      if (trimmed.startsWith(fence) && /^`+$/.test(trimmed)) {
        close = j;
        break;
      }
    }
    // An unterminated fence is prose.
    if (close < 0) continue;
    if (opening[2].trim() === 'bava-canvas') {
      const start = offsets[i + 1];
      const end = offsets[close];
      found = { body: text.slice(start, end), start, end };
    }
    i = close;
  }
  return found;
}

/** The files the canvas's picture elements name, in order; none when it cannot be read. */
export function canvasPictureFiles(text: string): string[] {
  const block = canvasBlock(text);
  if (!block) return [];
  try {
    const scene = JSON.parse(block.body) as { elements?: { type?: unknown; file?: unknown }[] };
    return (scene.elements ?? []).flatMap((e) => (e?.type === 'image' && typeof e.file === 'string' ? [e.file] : []));
  } catch {
    return [];
  }
}

/**
 * The page with its canvas's pictures of `from` renamed `to`; null when it
 * shows none, or names it in a way this cannot find. Only those values
 * change: the rest of the file is kept byte for byte.
 */
export function renamedPictures(text: string, from: string, to: string): string | null {
  if (!canvasPictureFiles(text).includes(from)) return null;
  const block = canvasBlock(text)!;
  const written = new RegExp(`("file"\\s*:\\s*)${JSON.stringify(from).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
  const body = block.body.replace(written, (_, key: string) => key + JSON.stringify(to));
  // Written some other way (an escape where plain text would do): not renamed, and said so.
  if (body === block.body) return null;
  return text.slice(0, block.start) + body + text.slice(block.end);
}
