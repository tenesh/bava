/**
 * An image's or a video's menu, from its block: its settings, its caption,
 * and its file (replaced, renamed, shown in its folder). Ids start `m:`;
 * `m:set:` ones are settings the block takes as they are.
 */
import type { MenuNode } from '../canvas/context-menu';
import { t } from '../i18n/t';
import type { MessageKey } from '../i18n/messages';

const item = (id: string, label: MessageKey): MenuNode => ({ kind: 'item', id, label: t(label), keys: '' });

type Toggles = { loop: boolean; muted: boolean; poster: string | null };

/**
 * The menu's own items; `attachment` when the file is in the Space's
 * attachments, which alone Bava renames. Outside a Space (`inSpace` false),
 * nothing that keeps or finds a file is offered; a file on the web (`web`) is
 * not shown in a folder.
 */
export function mediaMenuItems(kind: 'image' | 'video', attrs: Toggles, attachment: boolean, inSpace = true, web = false): MenuNode[] {
  const video = kind === 'video';
  return [
    {
      kind: 'submenu',
      id: 'm:width',
      label: t('media.width'),
      items: [
        item('m:set:width:', 'media.width.own'),
        item('m:set:width:small', 'media.width.small'),
        item('m:set:width:medium', 'media.width.medium'),
        item('m:set:width:large', 'media.width.large'),
        item('m:set:width:full', 'media.width.full'),
      ],
    },
    {
      kind: 'submenu',
      id: 'm:ratio',
      label: t('media.ratio'),
      items: [item('m:set:ratio:', 'media.ratio.own'), item('m:set:ratio:16:9', 'media.ratio.wide'), item('m:set:ratio:4:3', 'media.ratio.standard'), item('m:set:ratio:1:1', 'media.ratio.square')],
    },
    {
      kind: 'submenu',
      id: 'm:align',
      label: t('media.align'),
      items: [item('m:set:align:left', 'media.align.left'), item('m:set:align:', 'media.align.center'), item('m:set:align:right', 'media.align.right')],
    },
    item('m:caption', 'media.caption'),
    ...(video
      ? [
          item('m:set:loop', attrs.loop ? 'media.noLoop' : 'media.loop'),
          item('m:set:muted', attrs.muted ? 'media.unmute' : 'media.mute'),
          ...(inSpace ? [item('m:poster', 'media.poster')] : []),
          ...(attrs.poster ? [item('m:noposter', 'media.noPoster')] : []),
        ]
      : [item('m:fullscreen', 'media.fullScreen')]),
    ...(inSpace
      ? [{ kind: 'separator' } satisfies MenuNode, item('m:replace', 'media.replace'), ...(attachment ? [item('m:rename', 'media.rename')] : []), ...(web ? [] : [item('m:reveal', 'space.reveal')])]
      : []),
  ];
}

/** The settings an `m:set:` item (or removing the poster) gives the block; null for any other item. */
export function mediaSetting(id: string, attrs: Record<string, unknown>): Record<string, unknown> | null {
  if (id === 'm:noposter') return { poster: null };
  if (id === 'm:set:loop') return { loop: !attrs.loop };
  if (id === 'm:set:muted') return { muted: !attrs.muted };
  const setting = /^m:set:(width|ratio|align):(.*)$/.exec(id);
  return setting ? { [setting[1]]: setting[2] || null } : null;
}

/** The name a video's frame is kept under as its poster: the video's, with ` poster.png`. */
export function posterName(src: string): string {
  const path = src.replace(/[?#].*$/, '');
  const file = path.slice(path.lastIndexOf('/') + 1);
  let name = file;
  try {
    name = decodeURIComponent(file);
  } catch {
    // Kept as written.
  }
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name} poster.png`;
}
