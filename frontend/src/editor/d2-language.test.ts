import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { D2_KEYWORDS, tokenise } from './d2-language';

/** The tokens of a source, blanks left out: [text, kind]. */
const kinds = (source: string) => tokenise(source).filter(([text]) => text.trim() !== '');

describe('the D2 tokeniser', () => {
  it('reads a comment, on its own line or after code', () => {
    expect(kinds('# a note')).toEqual([['# a note', 'comment']]);
    expect(kinds('a -> b # why')).toEqual([
      ['a', 'name'],
      ['->', 'operator'],
      ['b', 'name'],
      ['# why', 'comment'],
    ]);
  });

  it('reads names, nested names and the reserved words among them', () => {
    expect(kinds('api.style.fill: red')).toEqual([
      ['api', 'name'],
      ['.', 'punctuation'],
      ['style', 'keyword'],
      ['.', 'punctuation'],
      ['fill', 'keyword'],
      [':', 'punctuation'],
      ['red', 'string'],
    ]);
    expect(kinds('grid-rows: 2')).toEqual([
      ['grid-rows', 'keyword'],
      [':', 'punctuation'],
      ['2', 'number'],
    ]);
    // A name with spaces, as D2 allows.
    expect(kinds('Orders DB: { shape: cylinder }')).toEqual([
      ['Orders', 'name'],
      ['DB', 'name'],
      [':', 'punctuation'],
      ['{', 'punctuation'],
      ['shape', 'keyword'],
      [':', 'punctuation'],
      ['cylinder', 'string'],
      ['}', 'punctuation'],
    ]);
  });

  it('reads a label or value after a colon, quoted or not, to the end of the line, a semicolon or a brace', () => {
    expect(kinds('a: Orders and refunds; b')).toEqual([
      ['a', 'name'],
      [':', 'punctuation'],
      ['Orders and refunds', 'string'],
      [';', 'punctuation'],
      ['b', 'name'],
    ]);
    expect(kinds('a: "say \\"hi\\"" {')).toEqual([
      ['a', 'name'],
      [':', 'punctuation'],
      ['"say \\"hi\\""', 'string'],
      ['{', 'punctuation'],
    ]);
  });

  it('reads numbers, true, false and null as values', () => {
    expect(kinds('width: 120')).toEqual([['width', 'keyword'], [':', 'punctuation'], ['120', 'number']]);
    expect(kinds('style.opacity: 0.5')).toEqual([
      ['style', 'keyword'],
      ['.', 'punctuation'],
      ['opacity', 'keyword'],
      [':', 'punctuation'],
      ['0.5', 'number'],
    ]);
    for (const value of ['true', 'false', 'null']) expect(kinds(`bold: ${value}`)[2]).toEqual([value, 'number']);
  });

  it('reads connections, chained and labelled', () => {
    expect(kinds('a -> b <- c <-> d -- e: calls')).toEqual([
      ['a', 'name'],
      ['->', 'operator'],
      ['b', 'name'],
      ['<-', 'operator'],
      ['c', 'name'],
      ['<->', 'operator'],
      ['d', 'name'],
      ['--', 'operator'],
      ['e', 'name'],
      [':', 'punctuation'],
      ['calls', 'string'],
    ]);
    expect(kinds('a->b')).toEqual([['a', 'name'], ['->', 'operator'], ['b', 'name']]);
  });

  it('reads globs, filters, variables and brackets', () => {
    expect(kinds('*.style.fill: blue')[0]).toEqual(['*', 'operator']);
    expect(kinds('**')).toEqual([['**', 'operator']]);
    expect(kinds('&shape: rect')[0]).toEqual(['&', 'operator']);
    expect(kinds('!&shape: rect')[0]).toEqual(['!&', 'operator']);
    expect(kinds('label: ${server}')).toEqual([['label', 'keyword'], [':', 'punctuation'], ['${server}', 'type']]);
    expect(kinds('classes: [a; b]')).toEqual([
      ['classes', 'keyword'],
      [':', 'punctuation'],
      ['[', 'punctuation'],
      ['a', 'string'],
      [';', 'punctuation'],
      ['b', 'string'],
      [']', 'punctuation'],
    ]);
  });

  it('reads a block string over several lines, whatever its delimiter', () => {
    expect(kinds('doc: |md\n  # Title\n  text\n|\nnext')).toEqual([
      ['doc', 'name'],
      [':', 'punctuation'],
      ['|md', 'string'],
      ['  # Title', 'string'],
      ['  text', 'string'],
      ['|', 'string'],
      ['next', 'name'],
    ]);
    expect(kinds('code: |||go\nx := a | b\n|||')).toEqual([
      ['code', 'name'],
      [':', 'punctuation'],
      ['|||go', 'string'],
      ['x := a | b', 'string'],
      ['|||', 'string'],
    ]);
  });

  it('reads a connection with heads at both ends, however long', () => {
    expect(kinds('a <--> b')).toEqual([['a', 'name'], ['<-->', 'operator'], ['b', 'name']]);
  });

  it('reads a variable in the middle of a value as a variable, and the value round it as the value', () => {
    expect(kinds('label: hello ${x} there')).toEqual([
      ['label', 'keyword'],
      [':', 'punctuation'],
      ['hello', 'string'],
      ['${x}', 'type'],
      ['there', 'string'],
    ]);
  });

  it('takes a quote inside a name as part of the name', () => {
    expect(kinds("Bob's server: x")).toEqual([
      ['Bob', 'name'],
      ["'s", 'name'],
      ['server', 'name'],
      [':', 'punctuation'],
      ['x', 'string'],
    ]);
  });

  it('reads a number or null before a brace as a value of its own', () => {
    expect(kinds('a: null {')).toEqual([['a', 'name'], [':', 'punctuation'], ['null', 'number'], ['{', 'punctuation']]);
    expect(kinds('a: 3 {')).toEqual([['a', 'name'], [':', 'punctuation'], ['3', 'number'], ['{', 'punctuation']]);
  });

  it('never lets an unclosed quote run past its line', () => {
    expect(kinds('a: "open\nb -> c')).toEqual([
      ['a', 'name'],
      [':', 'punctuation'],
      ['"open', 'string'],
      ['b', 'name'],
      ['->', 'operator'],
      ['c', 'name'],
    ]);
  });

  it("knows D2's own reserved words, no more and no fewer", () => {
    const listed = JSON.parse(readFileSync(new URL('../../../testdata/d2/keywords.json', import.meta.url), 'utf8')) as string[];
    expect([...D2_KEYWORDS].sort()).toEqual(listed);
  });
});
