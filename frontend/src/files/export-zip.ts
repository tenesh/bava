/**
 * What a page's or a folder's Markdown zip carries beside its pages: the
 * attachments those pages use, read as the Media dialog reads them, and the
 * name the zip is offered under.
 */
import { mediaItems, type AttachmentFile, type PageText } from './media';

/** The attachments the given pages use, each once, by name. */
export function attachmentsFor(files: AttachmentFile[], pages: PageText[], paths: string[]): string[] {
  const wanted = new Set(paths);
  const used = mediaItems(
    files,
    pages.filter((page) => wanted.has(page.path)),
  );
  return used
    .filter((item) => item.usedBy.length > 0)
    .map((item) => item.name)
    .sort();
}

/** The zip's name: the page's title, the folder's name, or the Space's. */
export function zipName(kind: 'page' | 'folder' | 'space', path: string, spaceName: string): string {
  const last = path.slice(path.lastIndexOf('/') + 1);
  const base = kind === 'space' ? spaceName : kind === 'page' ? last.replace(/\.md$/i, '') : last;
  return `${base}.zip`;
}
