import { describe, expect, it } from 'vitest';
import { columnsFor, columnsIn, wrapLine, wrapRuns } from './wrap';
import type { Run } from './highlight';

// A code block's width is the user's; its lines wrap to it (docs/file-format.md,
// "Code blocks"): at the last space that fits, or hard for a word too long.
describe('wrapping a line of code', () => {
  it('leaves a line that fits alone', () => {
    expect(wrapLine('let a = 1', 20)).toEqual(['let a = 1']);
  });

  it('breaks after the last space that fits', () => {
    expect(wrapLine('const value = compute(input)', 16)).toEqual(['const value = ', 'compute(input)']);
  });

  it('breaks a word longer than the width at the edge', () => {
    expect(wrapLine('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('keeps an empty line as one line', () => {
    expect(wrapLine('', 10)).toEqual(['']);
  });

  it('counts a wide glyph as two columns', () => {
    expect(wrapLine('日本語', 4)).toEqual(['日本', '語']);
  });
});

describe('wrapping highlighted runs', () => {
  it('splits runs where the text wraps, keeping their kinds', () => {
    const line: Run[] = [
      { text: 'const ', kind: 'keyword' },
      { text: 'value', kind: 'name' },
      { text: ' = 1', kind: 'plain' },
    ];
    expect(wrapRuns([line], 10)).toEqual([
      [{ text: 'const ', kind: 'keyword' }],
      [
        { text: 'value', kind: 'name' },
        { text: ' = 1', kind: 'plain' },
      ],
    ]);
  });
});

describe('the columns a width holds', () => {
  it('is the width inside the padding, in advances, at least one', () => {
    expect(columnsFor(136, { advance: 6, lineHeight: 20, padding: 8 })).toBe(20);
    expect(columnsFor(5, { advance: 6, lineHeight: 20, padding: 8 })).toBe(1);
  });
});

// A block written before widths were the user's was sized to its longest line,
// with the width tidied to three decimals: a hair short must not wrap it.
describe('a width sized to fit its longest line', () => {
  it('holds that line without wrapping', () => {
    const metrics = { advance: 7.80078, lineHeight: 19.5, padding: 8 };
    const width = Math.round((20 * metrics.advance + 16) * 1000) / 1000 - 0.001;
    expect(columnsFor(width, metrics)).toBe(20);
  });
});

// Review of 06.12: a wide glyph that forces a break at a space must not
// overflow the row it lands on.
describe('a wide glyph after a break', () => {
  it('never makes a row wider than the width', () => {
    for (const row of wrapLine(' ab中', 3)) expect(columnsIn(row)).toBeLessThanOrEqual(3);
  });
});
