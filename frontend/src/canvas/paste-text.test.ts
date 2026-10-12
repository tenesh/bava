import { describe, expect, it } from 'vitest';
import { pastedText, textSize } from './paste-text';
import { wrapLines } from './text-layout';

// Six units a character, a 10-unit line: the arithmetic shows.
const font = { size: 10, lineHeight: 1 };
const widthOf = (line: string) => line.length * 6;

describe('text pasted onto the canvas', () => {
  it('is one text element, its line breaks kept, centred where it lands', () => {
    const e = pastedText('Meeting notes\nAna orders', { x: 100, y: 100 }, font, widthOf, 300);
    expect(e).toMatchObject({ type: 'text', text: 'Meeting notes\nAna orders', w: 78, h: 20, measuredWidth: 78, measuredHeight: 20 });
    expect(e.x + e.w / 2).toBe(100);
    expect(e.y + e.h / 2).toBe(100);
  });

  it('wraps a long paragraph at the width given, growing taller', () => {
    const e = pastedText('aaaa bbbb cccc dddd eeee', { x: 0, y: 0 }, font, widthOf, 60);
    expect(e.w).toBe(60);
    expect(e.h).toBe(30);
    for (const line of wrapLines('aaaa bbbb cccc dddd eeee', e.w, widthOf)) expect(widthOf(line)).toBeLessThanOrEqual(e.w);
  });
});

describe("a text element's size as its text changes", () => {
  it('follows its longest line while it is not wrapped', () => {
    expect(textSize('hello world', { w: 66, natural: 66 }, font, widthOf)).toEqual({ width: 66, height: 10 });
  });

  it('keeps the width it was wrapped at, growing taller, once narrower than its text', () => {
    expect(textSize('aaaa bbbb cccc dddd eeee', { w: 60, natural: 144 }, font, widthOf)).toEqual({ width: 60, height: 30 });
  });
});
