// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { canvasLineWidth, measureFor, measureTextBlock } from './text-measure';

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

// Free text is measured at the size it is drawn at. Measured at the UI's body
// size whatever its own, a text at 28 stored a box for 13 and wrapped.
describe('measureFor', () => {
  const lineWidth = (font: string) => (line: string) => line.length * parseFloat(font);

  it('measures at the font size it is given', () => {
    const small = measureFor('ab\ncd', { family: 'Geist', size: 20, lineHeight: 1.2 }, lineWidth);
    const large = measureFor('ab\ncd', { family: 'Geist', size: 40, lineHeight: 1.2 }, lineWidth);
    expect(large.height).toBeCloseTo(small.height * 2);
    expect(large.width).toBeCloseTo(small.width * 2);
  });

  it('measures lines with the font the stage draws with', () => {
    const fonts: string[] = [];
    measureFor('a', { family: 'Geist', size: 28, lineHeight: 1.2 }, (font) => {
      fonts.push(font);
      return () => 0;
    });
    expect(fonts).toEqual(['28px Geist']);
  });
});

// Measuring runs for every label on every render; a canvas per call was a
// fresh allocation each time.
describe('canvasLineWidth', () => {
  it('creates one canvas however many times it is asked', () => {
    canvasLineWidth('20px Geist')('warm up');
    const spy = vi.spyOn(document, 'createElement');
    for (let i = 0; i < 5; i++) canvasLineWidth(`${i}px Geist`)('abc');
    expect(spy.mock.calls.filter(([tag]) => tag === 'canvas')).toHaveLength(0);
    spy.mockRestore();
  });
});
