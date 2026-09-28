/**
 * For tests: the caret at the end of the page's text, before the empty line
 * the page always ends with.
 */
import { TextSelection } from 'prosemirror-state';
import type { Node } from 'prosemirror-model';
import { endLineRange } from './lines';

export function atTextEnd(doc: Node): TextSelection {
  const line = endLineRange(doc);
  return TextSelection.near(doc.resolve(line ? line.from : doc.content.size), -1) as TextSelection;
}
