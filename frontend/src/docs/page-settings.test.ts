import { describe, expect, it } from 'vitest';
import { pageWidth } from './page-settings';

describe("a page's width", () => {
  it("is the page's own when it sets one", () => {
    expect(pageWidth('full', 'narrow', 'wide')).toBe('full');
  });

  it("is the Space's when the page sets none", () => {
    expect(pageWidth(undefined, 'narrow', 'full')).toBe('narrow');
  });

  it("is the app's when neither the page nor the Space sets one", () => {
    expect(pageWidth(undefined, '', 'full')).toBe('full');
  });

  it('is wide when nothing sets one, or what is set is not a width', () => {
    expect(pageWidth(undefined, '', '')).toBe('wide');
    expect(pageWidth('huge', 'tiny', 'enormous')).toBe('wide');
  });
});
