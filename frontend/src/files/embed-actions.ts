/**
 * Making canvas embeds and keeping their pictures current: the frames a page
 * can embed, the first picture of a frame (named once, reused by every later
 * embed of it), and the pictures a page's save draws again. The reading,
 * drawing and writing come from the caller.
 */
import type { FrameElement, SceneData } from '../canvas/scene';
import { linkTo } from '../docs/links';
import { t } from '../i18n/t';
import { pictureName, picturesOf, type PageText } from './embeds';

export type EmbedIO = {
  /** The open page's path in its Space; null for a loose page. */
  here: () => string | null;
  inSpace: () => boolean;
  /** Offers to make the loose page a Space; true once it is one. */
  offerSpace: () => Promise<boolean>;
  /** The Space's pages with their text, the open page as it is now; null when they cannot be read. */
  pages: () => Promise<PageText[] | null>;
  /** A page's canvas: the open page's live, another's from its file; null when it cannot be read. */
  scene: (page: string) => Promise<SceneData | null>;
  /** The frame's picture, in the theme Bava has now; null when the scene has no such frame. */
  picture: (scene: SceneData, frame: string) => Promise<Blob | null>;
  /** Writes a picture to the attachments: a free name first, or `name` itself with `replace`. */
  save: (name: string, data: Blob, replace: boolean) => Promise<{ name: string } | { error: string }>;
  insert: (attrs: { frame: string; page: string | null; src: string; alt: string }) => void;
  notify: (message: string) => void;
};

const ATTACHMENTS = '.bava/attachments/';

const framesOf = (scene: SceneData) => scene.elements.filter((element): element is FrameElement => element.type === 'frame');
const labelOf = (frame: FrameElement) => frame.label?.trim() || t('frames.untitled');

/** The picker's groups: this page's frames first, then each other page's that has any, by label. */
export async function frameGroups(io: EmbedIO, options: { thumb: (scene: SceneData, frame: string) => Promise<string | null> }) {
  const here = io.here();
  const others = ((await io.pages()) ?? []).filter((page) => page.path !== here);
  const sources: { page: string | null; title: string; path: string | null }[] = [
    ...(here ? [{ page: null, title: t('frames.thisPage'), path: here }] : []),
    ...others.map((page) => ({ page: page.path, title: page.name, path: page.path })),
  ];
  const groups = await Promise.all(
    sources.map(async (source) => {
      const scene = source.path ? await io.scene(source.path) : null;
      const frames = scene ? await Promise.all(framesOf(scene).map(async (frame) => ({ id: frame.id, label: labelOf(frame), thumb: await options.thumb(scene, frame.id) }))) : [];
      return { page: source.page, title: source.title, frames };
    }),
  );
  return groups.filter((group) => group.frames.length > 0);
}

/**
 * Embeds a frame at the page's caret: the picture any page already embeds of
 * it, or a new one drawn and named now. A loose page is asked to become a
 * Space first.
 */
export async function embedFrame(frame: string, page: string | null, io: EmbedIO): Promise<void> {
  if (!io.inSpace() && !(await io.offerSpace())) return;
  const here = io.here();
  if (!here) return;
  const holder = page ?? here;
  const pages = (await io.pages()) ?? [];
  let picture = [...(picturesOf(pages, holder).get(frame) ?? [])][0];
  const scene = await io.scene(holder);
  const element = scene ? framesOf(scene).find((each) => each.id === frame) : undefined;
  if (!scene || !element) {
    io.notify(t('embed.failed'));
    return;
  }
  if (picture === undefined) {
    const data = await io.picture(scene, frame);
    if (!data) {
      io.notify(t('embed.failed'));
      return;
    }
    const saved = await io.save(pictureName(holder, element.label ?? null), data, false);
    if ('error' in saved) {
      io.notify(saved.error);
      return;
    }
    picture = saved.name;
  }
  io.insert({
    frame,
    page: page === null ? null : linkTo(here, page, ''),
    src: linkTo(here, ATTACHMENTS + picture, ''),
    alt: element.label?.trim() || t('frames.untitled'),
  });
}

/**
 * Draws again, in the theme Bava has now, every picture any page embeds of
 * `page`'s frames, written in place (unchanged bytes are not). A frame that
 * is gone keeps its last picture.
 */
export async function redrawPictures(page: string, scene: SceneData, io: EmbedIO): Promise<void> {
  const pages = await io.pages();
  if (!pages) return;
  for (const [frame, names] of picturesOf(pages, page)) {
    const data = await io.picture(scene, frame);
    if (!data) continue;
    for (const name of names) {
      const saved = await io.save(name, data, true);
      if ('error' in saved) io.notify(saved.error);
    }
  }
}
