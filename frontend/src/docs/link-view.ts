/**
 * Links in the page: a link to a page missing from the Space is marked, and
 * a click reports the link under it so the app can show its card.
 */
import { Plugin, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Mark } from 'prosemirror-model';
import { missingTarget } from './links';
import type { PageRef } from './mention';

/** A link run in the page: its range and address. */
export type LinkAt = { from: number; to: number; href: string; mark: Mark };

/** The whole link around `pos`: every run of text next to it carrying the same link. */
export function linkAt(state: EditorState, pos: number): LinkAt | null {
  const $pos = state.doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent.inlineContent) return null;
  const start = $pos.start();
  const runs: { from: number; to: number; mark: Mark | undefined }[] = [];
  parent.forEach((child, offset) => {
    runs.push({ from: start + offset, to: start + offset + child.nodeSize, mark: child.marks.find((m) => m.type.name === 'link') });
  });
  // The run holding `pos`, or the one ending there when a click lands at a link's end.
  const inside = runs.findIndex((run) => run.mark && run.from <= pos && pos < run.to);
  const index = inside >= 0 ? inside : runs.findIndex((run) => run.mark && run.to === pos);
  if (index < 0) return null;
  const mark = runs[index].mark!;
  let first = index;
  let last = index;
  while (first > 0 && runs[first - 1].mark?.eq(mark)) first -= 1;
  while (last < runs.length - 1 && runs[last + 1].mark?.eq(mark)) last += 1;
  return { from: runs[first].from, to: runs[last].to, href: mark.attrs.href as string, mark };
}

/** Marks links to pages the Space does not have; nothing before the pages are read, or outside a Space. */
export function missingLinksPlugin(source: () => { here: string | null; pages: PageRef[] | null }): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const { here, pages } = source();
        if (here === null || !pages) return null;
        const paths = new Set(pages.map((page) => page.path));
        const marks: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          const link = node.isText ? node.marks.find((m) => m.type.name === 'link') : undefined;
          if (link && missingTarget(here, link.attrs.href as string, paths)) marks.push(Decoration.inline(pos, pos + node.nodeSize, { class: 'link-missing' }));
        });
        return DecorationSet.create(state.doc, marks);
      },
    },
  });
}
