import { describe, expect, it } from 'vitest';
import { overflowBox, wrapLines } from './text-layout';

// Six units per character, so the arithmetic in the expectations is obvious.
const width = (line: string) => line.length * 6;

describe('breaking text into lines', () => {
  it('keeps text that fits on one line', () => {
    expect(wrapLines('one two', 100, width)).toEqual(['one two']);
  });

  it('breaks on spaces, filling each line', () => {
    // 'aaa bbb' is 42 wide, 'aaa bbb ccc' is 66: only two words fit in 50.
    expect(wrapLines('aaa bbb ccc', 50, width)).toEqual(['aaa bbb', 'ccc']);
  });

  it('keeps the line breaks the user typed', () => {
    expect(wrapLines('one\ntwo', 100, width)).toEqual(['one', 'two']);
    expect(wrapLines('aaa bbb\nccc', 50, width)).toEqual(['aaa bbb', 'ccc']);
  });

  // A single word longer than the box has nowhere to break: it overflows
  // rather than being cut, which is what Konva does and what a reader expects.
  it('leaves a word that cannot fit on its own line', () => {
    expect(wrapLines('aaaaaaaaaa bb', 30, width)).toEqual(['aaaaaaaaaa', 'bb']);
  });

  it('treats a width of zero or less as no wrapping', () => {
    expect(wrapLines('aaa bbb ccc', 0, width)).toEqual(['aaa bbb ccc']);
  });

  it('keeps an empty line rather than dropping it', () => {
    expect(wrapLines('one\n\ntwo', 100, width)).toEqual(['one', '', 'two']);
  });
});

// A word wider than its box is drawn whole and overflows: centred text both
// ways, left-aligned text to the right, right-aligned text to the left.
describe('the box a word wider than its box is drawn in', () => {
  it('is the box itself when every line fits', () => {
    expect(overflowBox(10, 100, 80, 'center')).toEqual({ x: 10, width: 100 });
  });

  it('grows both ways when centred', () => {
    expect(overflowBox(10, 100, 140, 'center')).toEqual({ x: -10, width: 140 });
  });

  it('grows to the right when left-aligned, and to the left when right-aligned', () => {
    expect(overflowBox(10, 100, 140, 'left')).toEqual({ x: 10, width: 140 });
    expect(overflowBox(10, 100, 140, 'right')).toEqual({ x: -30, width: 140 });
  });
});
