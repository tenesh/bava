import { describe, expect, it } from 'vitest';
import { measureTextBlock } from './text-measure';

// Width of a line: two units per character, so the test reads the arithmetic.
const widthOf = (line: string) => line.length * 2;

describe('measureTextBlock', () => {
  // Measured as one line, "a\nb" stored the height of a single line, and Konva
  // stops drawing lines that do not fit: only "a" appeared.
  it('measures every line: widest line, and a line height per line', () => {
    const size = measureTextBlock('short\nmuch longer line\nmid', { fontSize: 10, lineHeight: 1.2 }, widthOf);
    expect(size.width).toBe('much longer line'.length * 2);
    expect(size.height).toBeCloseTo(3 * 10 * 1.2);
  });

  it('gives an empty trailing line its height, as the editor shows it', () => {
    expect(measureTextBlock('a\n', { fontSize: 10, lineHeight: 1 }, widthOf).height).toBe(20);
  });
});
