/**
 * The block handle's geometry, apart from the screen: where a dragged block
 * lands, given the block the pointer is over and which half of it.
 */
import type { Node } from 'prosemirror-model';

/** The document position a dragged top-level block is dropped at. */
export function dropPosition(doc: Node, pos: number, half: 'top' | 'bottom'): number {
  let at = 0;
  for (let i = 0; i < doc.childCount; i += 1) {
    const end = at + doc.child(i).nodeSize;
    if (pos >= at && pos < end) return half === 'top' ? at : end;
    at = end;
  }
  return doc.content.size;
}
