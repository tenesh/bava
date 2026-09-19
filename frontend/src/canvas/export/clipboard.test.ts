// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { copyPng, copySvg } from './clipboard';

const blob = () => new Blob([], { type: 'image/png' });

describe('copying an SVG', () => {
  // SVG is text, so it goes through the Wails clipboard, which behaves the
  // same on macOS, Windows and Linux and asks no permission.
  it('writes the document through the text clipboard', async () => {
    const setText = vi.fn().mockResolvedValue(true);
    const result = await copySvg('<svg/>', { setText });
    expect(setText).toHaveBeenCalledWith('<svg/>');
    expect(result).toEqual({ copied: true });
  });

  it('reports a refusal rather than throwing', async () => {
    const result = await copySvg('<svg/>', { setText: () => Promise.reject(new Error('no clipboard')) });
    expect(result.copied).toBe(false);
  });
});

describe('copying a PNG', () => {
  // As Excalidraw does it: an image/png ClipboardItem through the webview's
  // own clipboard, since Wails carries text only.
  it('writes an image item built from the pending picture', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    // Not yet encoded: WebKit needs the item made inside the gesture, so the
    // first attempt must not wait for the blob.
    const result = await copyPng(new Promise<Blob>((resolve) => setTimeout(() => resolve(blob()))), {
      write,
      ClipboardItemCtor: FakeItem,
    });
    expect(write).toHaveBeenCalledTimes(1);
    const [items] = write.mock.calls[0];
    expect(items[0].types).toEqual(['image/png']);
    expect(items[0].promised).toBe(true);
    expect(result).toEqual({ copied: true });
  });

  // WKWebView and Safari require the write to start inside the user's gesture,
  // which means handing over a promise rather than an awaited blob.
  // An engine that refuses a pending item gets the awaited blob instead.
  it('retries with the encoded blob when the pending item is refused', async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error('not allowed')).mockResolvedValueOnce(undefined);
    const result = await copyPng(blob(), { write, ClipboardItemCtor: FakeItem });
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0][0][0].promised).toBe(true);
    expect(write.mock.calls[1][0][0].promised).toBe(false);
    expect(result).toEqual({ copied: true });
  });

  // WebKitGTK is the expected case. The caller opens the export dialog, so the
  // action still ends with the user holding the image.
  it('asks for the dialog when both writes are refused, and never throws', async () => {
    const write = vi.fn().mockRejectedValue(new Error('not allowed'));
    const result = await copyPng(blob(), { write, ClipboardItemCtor: FakeItem });
    expect(result).toMatchObject({ copied: false, offerDialog: true });
    expect(result.reason).toContain('not allowed');
  });

  it('asks for the dialog when the webview has no image clipboard at all', async () => {
    const result = await copyPng(blob(), { write: undefined, ClipboardItemCtor: undefined });
    expect(result).toMatchObject({ copied: false, offerDialog: true });
  });
});

/** Stands in for ClipboardItem, which jsdom does not have. */
class FakeItem {
  types: string[];
  promised: boolean;
  constructor(items: Record<string, Blob | Promise<Blob>>) {
    this.types = Object.keys(items);
    this.promised = Object.values(items).some((value) => value instanceof Promise);
  }
}
