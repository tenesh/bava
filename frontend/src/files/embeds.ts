/**
 * Canvas embeds across a Space: the name a frame's picture is first saved
 * under, the embeds a page holds, and the pictures of a page's frames that
 * any page embeds (what saving that page draws again). Read with the
 * Document's own reader, so an embed here is exactly one in the page.
 */
import { parsePage } from '../docs/markdown';
import { linkName, resolveLink } from '../docs/links';

const ATTACHMENTS = '.bava/attachments/';

/** A page of the Space with its text, as the file side lists it. */
export type PageText = { name: string; path: string; text: string };

/** One embed: its frame, the Space path of the page holding the frame, and its picture's name in the attachments. */
export type EmbedRef = { frame: string; page: string; picture: string };

/**
 * A frame with no label names its picture this. Part of the file format, so
 * the same in every language and not in `messages.ts`.
 */
export const UNTITLED_PICTURE = 'Frame';

/** What a file name cannot hold, on any system Bava runs on (control characters too, below). */
const FORBIDDEN = /[/\\:*?"<>|]/g;

/** Each control character made a dash. */
const withoutControls = (text: string) => [...text].map((c) => (c.charCodeAt(0) < 32 ? '-' : c)).join('');

/**
 * The name a frame's picture is first saved under: `<page name> - <frame
 * label>.png`, or `<page name> - Frame.png` for a frame with no label, with
 * what a file name cannot hold made a dash.
 */
export function pictureName(page: string, label: string | null): string {
  const words = (label ?? '').trim() || UNTITLED_PICTURE;
  const name = withoutControls(`${linkName(page)} - ${words}`).replace(FORBIDDEN, '-');
  return `${name.replace(/^[.\s]+|[.\s]+$/g, '').replace(/ - [.\s]+/, ' - ')}.png`;
}

/** The embeds in a page, in order; one whose page or picture cannot be placed is left out. */
export function embedsIn(path: string, text: string): EmbedRef[] {
  const out: EmbedRef[] = [];
  parsePage(text).doc.descendants((node) => {
    if (node.type.name !== 'embed') return true;
    const page = node.attrs.page ? resolveLink(path, node.attrs.page as string)?.target : path;
    const picture = resolveLink(path, node.attrs.src as string)?.target;
    if (page && picture?.startsWith(ATTACHMENTS)) out.push({ frame: node.attrs.frame as string, page, picture: picture.slice(ATTACHMENTS.length) });
    return false;
  });
  return out;
}

/** Every picture any page embeds of `page`'s frames, by frame id. */
export function picturesOf(pages: PageText[], page: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const each of pages) {
    for (const embed of embedsIn(each.path, each.text)) {
      if (embed.page !== page) continue;
      const names = out.get(embed.frame) ?? new Set<string>();
      names.add(embed.picture);
      out.set(embed.frame, names);
    }
  }
  return out;
}
