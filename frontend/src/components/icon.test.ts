// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { iconSizeVar, type IconSize } from './icon';

describe('Icon sizing', () => {
  // Sizes are a string union, not a number: a component that takes `size={17}`
  // has left the token scale behind and nothing will notice.
  it('maps every size to a token', () => {
    const sizes: IconSize[] = ['sm', 'md', 'lg'];
    for (const size of sizes) {
      expect(iconSizeVar(size)).toMatch(/^var\(--/);
    }
  });

  it('gives distinct sizes distinct tokens', () => {
    const seen = new Set([iconSizeVar('sm'), iconSizeVar('md'), iconSizeVar('lg')]);
    expect(seen.size).toBe(3);
  });
});
