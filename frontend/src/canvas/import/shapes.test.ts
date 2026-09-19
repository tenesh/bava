import { describe, expect, it } from 'vitest';
import { canvasShapeFor } from './shapes';
import { SHAPE_TYPES } from '../scene';

describe('mapping a D2 shape onto the canvas set', () => {
  it('keeps the shapes Bava draws', () => {
    for (const shape of ['diamond', 'cylinder', 'hexagon', 'parallelogram', 'document', 'person', 'cloud']) {
      expect(canvasShapeFor(shape)).toBe(shape);
    }
  });

  it('maps D2 names onto Bava names', () => {
    expect(canvasShapeFor('rectangle')).toBe('rect');
    expect(canvasShapeFor('square')).toBe('rect');
    expect(canvasShapeFor('circle')).toBe('ellipse');
    expect(canvasShapeFor('oval')).toBe('ellipse');
  });

  // Rarer D2 shapes have no Bava equivalent and are not worth inventing: a
  // box with the right name says more than a shape nobody recognises.
  it('gives the shapes Bava has no drawing for a rectangle', () => {
    for (const shape of ['queue', 'page', 'package', 'step', 'callout', 'stored_data', 'c4-person']) {
      expect(canvasShapeFor(shape)).toBe('rect');
    }
  });

  it('falls back to a rectangle for anything unknown', () => {
    expect(canvasShapeFor('sql_table')).toBe('rect');
    expect(canvasShapeFor('')).toBe('rect');
    expect(canvasShapeFor('something-d2-adds-later')).toBe('rect');
  });

  // Whatever it returns has to be a type the canvas can actually draw.
  it('only ever names a shape the canvas has', () => {
    const drawable = new Set<string>(SHAPE_TYPES);
    for (const shape of ['rectangle', 'circle', 'queue', 'cloud', 'nonsense']) {
      expect(drawable.has(canvasShapeFor(shape))).toBe(true);
    }
  });
});
