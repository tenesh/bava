import { describe, expect, it } from 'vitest';
import { columnsIn, measureCode } from './measure';

// Six units per character, so the arithmetic in the expectations is obvious.
const metrics = { advance: 6, lineHeight: 20, padding: 8 };

describe('the size of a code block', () => {
  it('is as wide as its longest line, plus padding', () => {
    // 25 characters: 150 wide, plus 8 either side.
    expect(measureCode(`a\n${'x'.repeat(25)}\nc`, metrics).width).toBe(25 * 6 + 16);
  });

  // Room to type into: a new block is empty, and one a column wide showed a
  // single character of whatever was typed.
  it('is 20 columns wide when it is empty', () => {
    expect(measureCode('', metrics).width).toBe(20 * 6 + 16);
  });

  it('is 20 columns wide when its lines are shorter', () => {
    expect(measureCode('fn()', metrics).width).toBe(20 * 6 + 16);
  });

  it('is as tall as its line count, plus padding', () => {
    expect(measureCode('a\nb\nc', metrics).height).toBe(3 * 20 + 16);
  });

  // An empty block still has to be clickable, and still shows a cursor.
  it('is one line tall when it is empty', () => {
    expect(measureCode('', metrics).height).toBe(20 + 16);
    expect(measureCode('', metrics).width).toBeGreaterThan(0);
  });

  it('counts a trailing newline as the empty line it is', () => {
    expect(measureCode('a\n', metrics).height).toBe(2 * 20 + 16);
  });

  it('measures a tab as the spaces it is drawn with', () => {
    // The tokeniser turns a tab into four spaces; the measurement agrees.
    expect(measureCode('\tx', metrics).width).toBe(measureCode('    x', metrics).width);
  });

  it('never returns a fraction of a pixel, which a file would then carry', () => {
    const size = measureCode('abc', { advance: 6.6667, lineHeight: 19.2, padding: 8 });
    expect(Number.isInteger(size.width * 1000)).toBe(true);
    expect(Number.isInteger(size.height * 1000)).toBe(true);
  });
});

// A wide glyph is two columns in every terminal and editor, and Geist Mono
// has no CJK coverage anyway: counting code units would draw each run after
// one on top of the text before it, and under-size the panel.
describe('code that is not ASCII', () => {
  it('counts a wide glyph as two columns', () => {
    expect(columnsIn('日本')).toBe(4);
    expect(columnsIn('ab')).toBe(2);
  });

  it('sizes a block by columns, not characters', () => {
    // Twelve glyphs, two columns each: 24 columns, past the 20-column floor.
    expect(measureCode('日本語'.repeat(4), metrics).width).toBe(24 * 6 + 16);
  });

  // An emoji is a surrogate pair: one glyph, two code units, two columns.
  it('counts an emoji once, as two columns', () => {
    expect(columnsIn('🙂')).toBe(2);
  });

  it('leaves combining marks out, since they draw on the glyph before', () => {
    expect(columnsIn('é')).toBe(1);
  });
});

// With a width, the block is that wide and as tall as its wrapped lines.
describe('a block of a chosen width', () => {
  const metrics = { advance: 6, lineHeight: 20, padding: 8 };

  it('keeps the width it is given', () => {
    expect(measureCode('a', metrics, 200).width).toBe(200);
  });

  it('is as tall as its wrapped lines', () => {
    // 10 columns fit in 76 (76 - 16 = 60, / 6): 'abcdefghijklmnop' is 2 lines, 'x' 1.
    expect(measureCode('abcdefghijklmnop\nx', metrics, 76).height).toBe(3 * 20 + 16);
  });
});
