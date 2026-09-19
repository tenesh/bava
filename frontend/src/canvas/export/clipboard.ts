/**
 * Putting an export on the system clipboard.
 *
 * SVG is text, so it goes through the Wails clipboard, which behaves the same
 * on all three platforms and asks no permission (`docs/decisions.md`,
 * 2026-09-17).
 *
 * A picture cannot: the pinned Wails clipboard carries text only. So a PNG
 * goes the way Excalidraw does it, through the webview's own clipboard with an
 * `image/png` item, including the retry that WKWebView and Safari need, where
 * the item is built from a promise so the write starts inside the user's
 * gesture. Where that is refused (WebKitGTK is the expected case) the caller
 * is told to offer the export dialog instead, so the action still ends with
 * the user holding the image.
 */
import { Clipboard } from '@wailsio/runtime';

export type CopyResult = {
  copied: boolean;
  /** Whether the caller should offer the export dialog instead. */
  offerDialog?: boolean;
  /** What went wrong, for the status bar. */
  reason?: string;
};

type ItemConstructor = new (items: Record<string, Blob | Promise<Blob>>) => unknown;

export type PngClipboard = {
  /** The webview's clipboard write, absent where there is none. */
  write?: (items: unknown[]) => Promise<void>;
  /** ClipboardItem, absent where the webview has none. */
  ClipboardItemCtor?: ItemConstructor;
};

function browserClipboard(): PngClipboard {
  const clipboard = globalThis.navigator?.clipboard as { write?: (items: unknown[]) => Promise<void> } | undefined;
  const ctor = (globalThis as { ClipboardItem?: ItemConstructor }).ClipboardItem;
  return { write: clipboard?.write?.bind(clipboard), ClipboardItemCtor: ctor };
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Put SVG text on the clipboard. */
export async function copySvg(svg: string, options: { setText?: (text: string) => Promise<unknown> } = {}): Promise<CopyResult> {
  const setText = options.setText ?? ((text: string) => Clipboard.SetText(text));
  try {
    await setText(svg);
    return { copied: true };
  } catch (error) {
    return { copied: false, reason: message(error) };
  }
}

/**
 * Put a PNG on the clipboard, or ask the caller to offer the dialog.
 *
 * The picture arrives as a *promise*, not a blob, and the `ClipboardItem` is
 * built from it without awaiting: WebKit requires the write to begin inside
 * the gesture that asked for it, and awaiting the encoder first spends that
 * activation. Awaiting and retrying is the fallback, for engines that reject
 * a pending item instead.
 */
export async function copyPng(png: Promise<Blob> | Blob, clipboard: PngClipboard = browserClipboard()): Promise<CopyResult> {
  const { write, ClipboardItemCtor } = clipboard;
  if (!write || !ClipboardItemCtor) {
    return { copied: false, offerDialog: true, reason: 'this system has no image clipboard' };
  }
  const pending = Promise.resolve(png);
  try {
    await write([new ClipboardItemCtor({ 'image/png': pending })]);
    return { copied: true };
  } catch (first) {
    try {
      await write([new ClipboardItemCtor({ 'image/png': await pending })]);
      return { copied: true };
    } catch (second) {
      return { copied: false, offerDialog: true, reason: message(second) || message(first) };
    }
  }
}
