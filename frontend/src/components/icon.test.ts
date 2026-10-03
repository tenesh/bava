import { describe, expect, it } from 'vitest';
import { iconSizeVar } from './icon';

describe('iconSizeVar', () => {
  // Sizes are a string union, not a number: a component that takes `size={17}`
  // has left the token scale behind and nothing will notice.
  it.each([
    ['sm', 'var(--space-3)'],
    ['md', 'var(--space-4)'],
    ['lg', 'var(--space-5)'],
  ] as const)('maps %s to its spacing token', (size, token) => {
    expect(iconSizeVar(size)).toBe(token);
  });
});
