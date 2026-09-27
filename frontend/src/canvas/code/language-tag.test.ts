import { describe, expect, it } from 'vitest';
import { languageTag } from './language-tag';

// A code block names its language on its top edge, at the left, the
// border hidden behind the name.
describe("a code block's language tag", () => {
  const measure = (text: string) => text.length * 6;
  const block = (over: Record<string, unknown>) => ({ id: 'c', type: 'code', x: 0, y: 0, w: 200, h: 60, z: 1, code: '', ...over }) as never;

  it('is the language as the picker names it, on the top border at the left', () => {
    const tag = languageTag(block({ language: 'go' }), measure, { size: 10, lineHeight: 1.2, inset: 12, clearance: 4 });
    expect(tag).toMatchObject({ text: 'Go', x: 12, y: -6, w: 12, h: 12 });
    // The border is hidden from a little before the name to a little after.
    expect(tag!.gap.x).toBeLessThan(12);
    expect(tag!.gap.x + tag!.gap.w).toBeGreaterThan(24);
  });

  it('is nothing for plain text, or a language Bava does not know', () => {
    expect(languageTag(block({}), measure, { size: 10, lineHeight: 1.2, inset: 12, clearance: 4 })).toBeNull();
    expect(languageTag(block({ language: 'a-language-from-later' }), measure, { size: 10, lineHeight: 1.2, inset: 12, clearance: 4 })).toBeNull();
  });
});
