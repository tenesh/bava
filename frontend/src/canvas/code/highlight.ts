/**
 * Code, turned into coloured runs the canvas can draw.
 *
 * The colouring is CodeMirror's: the language's own Lezer parse, walked by
 * `@lezer/highlight`, whose tags are folded into a small vocabulary the theme
 * has colours for. Writing our own rules per language would be a second
 * highlighter that disagreed with the editor the user types in.
 *
 * Pure, so the stage and the exporter draw the same runs and a test needs no
 * canvas (`.ai/rules/canvas.md`).
 */
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import type { Parser } from '@lezer/common';
// One definition: a tab drawn as a different width here than it is measured
// as would put every stored size subtly wrong.
import { TAB } from './measure';

/** The kinds the theme has a `--syntax-*` colour for. */
export const RUN_KINDS = [
  'keyword',
  'string',
  'number',
  'comment',
  'name',
  'type',
  'operator',
  'punctuation',
  'plain',
] as const;

export type RunKind = (typeof RUN_KINDS)[number];

/** A stretch of one line that draws in one colour. */
export type Run = { text: string; kind: RunKind };



/**
 * Lezer's tags, folded into the kinds above.
 *
 * `tagHighlighter` gives back the first matching class name, so the mapping is
 * one lookup rather than a walk through tag hierarchies.
 */
const HIGHLIGHTER = tagHighlighter([
  { tag: tags.comment, class: 'comment' },
  { tag: tags.string, class: 'string' },
  { tag: tags.special(tags.string), class: 'string' },
  { tag: tags.number, class: 'number' },
  { tag: tags.bool, class: 'number' },
  { tag: tags.null, class: 'number' },
  { tag: tags.keyword, class: 'keyword' },
  { tag: tags.controlKeyword, class: 'keyword' },
  { tag: tags.moduleKeyword, class: 'keyword' },
  { tag: tags.definitionKeyword, class: 'keyword' },
  { tag: tags.operatorKeyword, class: 'keyword' },
  { tag: tags.self, class: 'keyword' },
  { tag: tags.atom, class: 'keyword' },
  { tag: tags.typeName, class: 'type' },
  { tag: tags.className, class: 'type' },
  { tag: tags.namespace, class: 'type' },
  { tag: tags.tagName, class: 'type' },
  { tag: tags.variableName, class: 'name' },
  { tag: tags.propertyName, class: 'name' },
  { tag: tags.attributeName, class: 'name' },
  { tag: tags.function(tags.variableName), class: 'name' },
  { tag: tags.definition(tags.variableName), class: 'name' },
  { tag: tags.operator, class: 'operator' },
  { tag: tags.punctuation, class: 'punctuation' },
  { tag: tags.bracket, class: 'punctuation' },
  { tag: tags.separator, class: 'punctuation' },
  { tag: tags.heading, class: 'keyword' },
  { tag: tags.link, class: 'string' },
  { tag: tags.emphasis, class: 'name' },
  { tag: tags.strong, class: 'name' },
]);

const kindOf = (classes: string): RunKind => {
  const first = classes.split(' ')[0] as RunKind;
  return (RUN_KINDS as readonly string[]).includes(first) ? first : 'plain';
};

/**
 * `code` as one array of runs per line.
 *
 * A null parser (plain text, or a language this build does not bundle) gives
 * one plain run per line. The runs of a line, concatenated, are exactly that
 * line: nothing is dropped and nothing is duplicated, which is what lets the
 * canvas lay them out by character count.
 */
export function toRuns(code: string, parser: Parser | null): Run[][] {
  const text = code.replace(/\t/g, TAB);
  const lines = text.split('\n');
  if (!parser) return lines.map((line) => (line === '' ? [] : [{ text: line, kind: 'plain' as const }]));

  // Where each line starts, so a token's absolute range can be cut per line.
  const starts: number[] = [];
  let at = 0;
  for (const line of lines) {
    starts.push(at);
    at += line.length + 1;
  }

  const runs: Run[][] = lines.map(() => []);
  const cursor = lines.map(() => 0);

  const push = (line: number, from: number, to: number, kind: RunKind) => {
    const slice = lines[line].slice(from, to);
    if (slice !== '') runs[line].push({ text: slice, kind });
  };

  /** Everything up to `until` that has not been emitted yet, as plain. */
  const fillTo = (line: number, until: number) => {
    if (cursor[line] < until) {
      push(line, cursor[line], until, 'plain');
      cursor[line] = until;
    }
  };

  const lineOf = (offset: number): number => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (starts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return low;
  };

  highlightTree(parser.parse(text), HIGHLIGHTER, (from, to, classes) => {
    const kind = kindOf(classes);
    // A token can span lines (a block comment, a template string), so it is
    // cut at each line's end.
    let start = from;
    while (start < to) {
      const line = lineOf(start);
      const lineEnd = starts[line] + lines[line].length;
      const end = Math.min(to, lineEnd);
      fillTo(line, start - starts[line]);
      push(line, start - starts[line], end - starts[line], kind);
      cursor[line] = end - starts[line];
      start = end + 1;
    }
  });

  // Whatever the parser said nothing about is plain text.
  for (let line = 0; line < lines.length; line += 1) fillTo(line, lines[line].length);
  return runs;
}
