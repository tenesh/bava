import { describe, expect, it } from 'vitest';
import { parsePage } from './markdown';
import { dropPosition } from './handle';

// Three blocks: "One" (0-5), "Two" (5-10), "Three" (10-17).
const doc = parsePage('One\n\nTwo\n\nThree\n').doc;

describe('where a dragged block lands', () => {
  it('goes before a block when dropped on its top half, after it on its bottom half', () => {
    expect(dropPosition(doc, 5, 'top')).toBe(5);
    expect(dropPosition(doc, 5, 'bottom')).toBe(10);
  });

  it('lands at the start or the end of the page', () => {
    expect(dropPosition(doc, 0, 'top')).toBe(0);
    expect(dropPosition(doc, 10, 'bottom')).toBe(doc.content.size);
  });

  it('finds the top-level block from a position inside it', () => {
    expect(dropPosition(doc, 7, 'bottom')).toBe(10);
  });
});
