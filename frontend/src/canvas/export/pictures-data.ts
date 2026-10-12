/**
 * Pictures inside an export: each picture element's file, as a data address,
 * so the SVG, the PDF and a pasted copy carry it rather than pointing back
 * into the Space. Read through the app's file route, as the canvas reads them.
 */
import type { SceneElement } from '../scene';
import { pictureAddress } from '../pictures';
import { base64 } from './fonts';

/** By attachment name: its data address, or null when it cannot be read. */
export async function picturesData(
  root: string | null,
  elements: SceneElement[],
  fetcher: (address: string) => Promise<Response> = fetch,
): Promise<Record<string, string | null>> {
  const files = [...new Set(elements.flatMap((e) => (e.type === 'image' ? [e.file] : [])))];
  const read = async (file: string): Promise<string | null> => {
    if (!root) return null;
    try {
      const response = await fetcher(pictureAddress(root, file));
      if (!response.ok) return null;
      const type = response.headers.get('Content-Type') || 'application/octet-stream';
      return `data:${type};base64,${base64(await response.arrayBuffer())}`;
    } catch {
      return null;
    }
  };
  return Object.fromEntries(await Promise.all(files.map(async (file) => [file, await read(file)] as const)));
}
