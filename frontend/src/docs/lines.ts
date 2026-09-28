/**
 * Adding a block before or after the block the caret is in, the same way for
 * every block, and always an empty line at the end of the page. The nearest
 * block that can have a line beside it is the one: a table cell cannot hold a
 * second block, so in a table it is the table. An empty last (or first) line
 * of a quote, callout or toggle moves out, after (or before) it, so a second
 * press leaves the block, as Enter on an empty list item leaves a list.
 */
import { AllSelection, NodeSelection, Plugin, TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import { GapCursor } from 'prosemirror-gapcursor';
import { Fragment, Slice, type Node, type ResolvedPos } from 'prosemirror-model';
import { CellSelection } from 'prosemirror-tables';
import { liftListItem } from 'prosemirror-schema-list';
import { schema } from './schema';

type Side = 'after' | 'before';

/** Containers an empty edge line moves out of; a footnote's lines stay in its note. */
const LEAVES = new Set(['blockquote', 'callout', 'toggle']);

/** Inserts an empty line at `pos` and puts the caret on it. */
function lineAt(tr: Transaction, pos: number): Transaction {
  tr.insert(pos, schema.nodes.paragraph.create());
  return tr.setSelection(TextSelection.create(tr.doc, pos + 1)).scrollIntoView();
}

/** An empty line beside the node at `depth` of `$pos`, or beside the nearest ancestor that can have one. */
function besideNode($pos: ResolvedPos, depth: number, side: Side, tr: Transaction): Transaction | null {
  for (let d = depth; d >= 1; d -= 1) {
    const parent = $pos.node(d - 1);
    const index = $pos.index(d - 1) + (side === 'after' ? 1 : 0);
    if (parent.canReplaceWith(index, index, schema.nodes.paragraph)) return lineAt(tr, side === 'after' ? $pos.after(d) : $pos.before(d));
  }
  return null;
}

function isEmptyLine(node: Node): boolean {
  return node.type === schema.nodes.paragraph && node.content.size === 0;
}

/** A new, empty list item like `like`: a to-do unticked. */
function itemLike(like: Node): Node {
  const checked = like.attrs.checked === null ? null : false;
  return schema.nodes.list_item.create({ ...like.attrs, checked }, schema.nodes.paragraph.create());
}

/** Inserts a new empty item at `pos` and puts the caret in it. */
function itemAt(tr: Transaction, pos: number, like: Node): Transaction {
  tr.insert(pos, itemLike(like));
  return tr.setSelection(TextSelection.create(tr.doc, pos + 2)).scrollIntoView();
}

/**
 * Adds a block before or after the nearest block (every case is a row in
 * `lines.test.ts`). An empty line at the edge of what holds it moves out one
 * level instead: out of a quote, callout or toggle; out of a list item as a
 * new item; out of a nested list into the list around it; out of a list.
 */
export function addBlock(side: Side): Command {
  return (state, dispatch) => {
    const tr = state.tr;
    const { selection } = state;
    let done: Transaction | null;

    if (selection instanceof AllSelection) {
      // Everything: before the first block, or after the last before the notes.
      const notes = state.doc.lastChild?.type === schema.nodes.footnotes ? state.doc.lastChild.nodeSize : 0;
      done = lineAt(tr, side === 'before' ? 0 : state.doc.content.size - notes);
    } else if (selection instanceof GapCursor) {
      const $pos = selection.$from;
      done = $pos.parent.canReplaceWith($pos.index(), $pos.index(), schema.nodes.paragraph) ? lineAt(tr, $pos.pos) : null;
    } else if (selection instanceof NodeSelection) {
      // Beside the selected block itself, else beside the nearest block around it.
      const $pos = selection.$from;
      const index = $pos.index() + (side === 'after' ? 1 : 0);
      if ($pos.parent.canReplaceWith(index, index, schema.nodes.paragraph)) done = lineAt(tr, side === 'after' ? selection.to : selection.from);
      else done = besideNode($pos, $pos.depth, side, tr);
    } else {
      // After the block a selection ends in; before the one it starts in.
      const $from = selection instanceof CellSelection ? selection.$anchorCell : side === 'after' ? selection.$to : selection.$from;
      const table = [...Array($from.depth + 1).keys()].reverse().find((d) => $from.node(d).type.name === 'table');
      const block = $from.parent;
      const depth = $from.depth;
      const container = depth > 1 ? $from.node(depth - 1) : null;
      const index = $from.index(depth - 1);
      if (table !== undefined) done = besideNode($from, table, side, tr);
      else if (block.type === schema.nodes.toggle_summary) done = besideNode($from, depth - 1, side, tr);
      else if (container?.type === schema.nodes.list_item && index === 0) {
        const list = $from.node(depth - 2);
        const itemIndex = $from.index(depth - 2);
        const edgeItem = side === 'after' ? itemIndex === list.childCount - 1 : itemIndex === 0;
        if (isEmptyLine(block) && container.childCount === 1 && edgeItem) {
          // An empty last (or first) item leaves its list, one level: into the
          // item around a nested list, as a line beside it or as a new item
          // after it when nothing of that item follows; else out of the list.
          // The list goes when this was its only item.
          const outer = depth > 3 && $from.node(depth - 3).type === schema.nodes.list_item ? $from.node(depth - 3) : null;
          const whole = list.childCount === 1;
          const from = whole ? $from.before(depth - 2) : $from.before(depth - 1);
          const to = whole ? $from.after(depth - 2) : $from.after(depth - 1);
          const lastInItem = outer !== null && $from.index(depth - 3) === outer.childCount - 1;
          if (outer && side === 'after' && lastInItem) {
            tr.delete(from, to);
            done = itemAt(tr, tr.mapping.map($from.after(depth - 3)), outer);
          } else if (whole) {
            tr.replaceWith(from, to, schema.nodes.paragraph.create());
            done = tr.setSelection(TextSelection.create(tr.doc, from + 1)).scrollIntoView();
          } else {
            tr.delete(from, to);
            done = lineAt(tr, side === 'after' ? tr.mapping.map($from.after(depth - 2)) : $from.before(depth - 2));
          }
        } else if (isEmptyLine(block) && container.childCount === 1) {
          // An empty item in the middle of its list leaves one level, as
          // Enter does: into the list around it, or out between its halves.
          let lifted: Transaction | null = null;
          liftListItem(schema.nodes.list_item)(state, (t) => (lifted = t.scrollIntoView()));
          done = lifted;
        } else done = itemAt(tr, side === 'after' ? $from.after(depth - 1) : $from.before(depth - 1), container);
      } else if (container?.type === schema.nodes.list_item && isEmptyLine(block) && (side === 'after' ? index === container.childCount - 1 : index === 1)) {
        // An empty line at an item's edge leaves it as a new item beside it.
        tr.delete($from.before(depth), $from.after(depth));
        done = itemAt(tr, side === 'after' ? tr.mapping.map($from.after(depth - 1)) : $from.before(depth - 1), container);
      } else if (container && LEAVES.has(container.type.name) && isEmptyLine(block)) {
        const first = container.type === schema.nodes.toggle ? 1 : 0;
        const atEdge = side === 'after' ? index === container.childCount - 1 : index === first;
        const alone = container.childCount - first === 1;
        if (alone) {
          // Its only line stays; the new one goes beside the container.
          done = besideNode($from, depth - 1, side, tr);
        } else if (atEdge) {
          tr.delete($from.before(depth), $from.after(depth));
          const outside = side === 'after' ? tr.mapping.map($from.after(depth - 1)) : $from.before(depth - 1);
          done = lineAt(tr, outside);
        } else done = besideNode($from, depth, side, tr);
      } else done = besideNode($from, depth, side, tr);
    }
    if (!done) return false;
    dispatch?.(done);
    return true;
  };
}

/** Where the page's end line belongs (after its last block, before its notes), or null when it has one. */
function endLineAt(doc: Node): number | null {
  const notes = doc.lastChild?.type === schema.nodes.footnotes;
  const last = notes ? (doc.childCount > 1 ? doc.child(doc.childCount - 2) : null) : doc.lastChild;
  if (last && isEmptyLine(last)) return null;
  return notes ? doc.content.size - doc.lastChild!.nodeSize : doc.content.size;
}

/** The page with an empty line at its end (before its notes); the page itself when it has one. */
export function endsWithALine(doc: Node): Node {
  const at = endLineAt(doc);
  return at === null ? doc : doc.replace(at, at, new Slice(Fragment.from(schema.nodes.paragraph.create()), 0, 0));
}

/** Keeps an empty line at the end of the page after every change. */
export function endLinePlugin(): Plugin {
  return new Plugin({
    appendTransaction(transactions, _old, state: EditorState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      const at = endLineAt(state.doc);
      return at === null ? null : state.tr.insert(at, schema.nodes.paragraph.create());
    },
  });
}

/** Where the empty line at the end of the page is, or null when the page has none there. */
export function endLineRange(doc: Node): { from: number; to: number } | null {
  const notes = doc.lastChild?.type === schema.nodes.footnotes;
  const index = notes ? doc.childCount - 2 : doc.childCount - 1;
  if (index < 0 || !isEmptyLine(doc.child(index))) return null;
  let from = 0;
  for (let i = 0; i < index; i += 1) from += doc.child(i).nodeSize;
  return { from, to: from + doc.child(index).nodeSize };
}

/** The text between two places, leaving out the empty line at the page's end, as a count or a copy reads it. */
export function textWithoutEndLine(doc: Node, from: number, to: number, leafText: string | ((leaf: Node) => string)): string {
  const line = endLineRange(doc);
  if (!line || to <= line.from || from >= line.to) return doc.textBetween(from, to, '\n', leafText);
  const before = from < line.from ? doc.textBetween(from, line.from, '\n', leafText) : '';
  const after = to > line.to ? doc.textBetween(line.to, to, '\n', leafText) : '';
  return before && after ? `${before}\n${after}` : before + after;
}

