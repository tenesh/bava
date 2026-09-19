import { describe, expect, it } from 'vitest';
import { RUN_KINDS, toRuns } from './highlight';
import { loadParser, resetLanguageCache } from './languages';

const js = async () => {
  resetLanguageCache();
  return loadParser('javascript');
};

const textOf = (lines: { text: string }[][]) => lines.map((runs) => runs.map((run) => run.text).join(''));

describe('turning code into coloured runs', () => {
  it('colours a keyword, a string and a comment', async () => {
    const parser = await js();
    const [line] = toRuns('const greeting = "hi" // wave', parser);
    const kinds = new Map(line.map((run) => [run.text.trim(), run.kind]));
    expect(kinds.get('const')).toBe('keyword');
    expect(kinds.get('"hi"')).toBe('string');
    expect(kinds.get('// wave')).toBe('comment');
  });

  // Nothing may be lost or duplicated: the runs of a line are that line.
  it('reproduces every line exactly', async () => {
    const parser = await js();
    const code = 'function f(a) {\n  return a + 1 // sum\n}\n\nconst x = f(2)';
    expect(textOf(toRuns(code, parser))).toEqual(code.split('\n'));
  });

  it('keeps blank lines, so the code keeps its shape', async () => {
    const parser = await js();
    const runs = toRuns('a\n\nb', parser);
    expect(runs).toHaveLength(3);
    expect(runs[1]).toEqual([]);
  });

  it('draws plain text when there is no parser', () => {
    const runs = toRuns('anything at all\nsecond line', null);
    expect(runs.map((line) => line.map((run) => run.kind))).toEqual([['plain'], ['plain']]);
    expect(textOf(runs)).toEqual(['anything at all', 'second line']);
  });

  it('turns tabs into spaces, so a line width is its character count', () => {
    const [line] = toRuns('\tif x:', null);
    expect(line[0].text.startsWith('    ')).toBe(true);
    expect(line[0].text).not.toContain('\t');
  });

  it('only ever uses a kind the theme has a colour for', async () => {
    const parser = await js();
    const code = 'class A extends B { async *gen() { yield `t${1}`; } } // done';
    for (const line of toRuns(code, parser)) {
      for (const run of line) expect(RUN_KINDS).toContain(run.kind);
    }
  });

  it('is one empty line for empty code', () => {
    expect(toRuns('', null)).toEqual([[]]);
  });
});
