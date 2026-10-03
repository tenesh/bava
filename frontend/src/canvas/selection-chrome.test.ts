import { describe, expect, it } from 'vitest';
import { besideLabel, labelSpotEnds } from './selection-chrome';
import type { SceneElement } from './scene';
import { routePoints } from './arrows';

// A handle the label covers is drawn, and pressed, where the line comes out
// from under the label, so the label stays readable and both can be grabbed.
describe('a handle under an arrow label', () => {
  const label = { x: 70, y: -10, w: 60, h: 20 };

  it('stays where it is when the label does not cover it', () => {
    expect(besideLabel({ x: 100, y: 0 }, [0, 0, 200, 0], null, 10)).toEqual({ x: 100, y: 0 });
    expect(besideLabel({ x: 30, y: 0 }, [0, 0, 200, 0], label, 10)).toEqual({ x: 30, y: 0 });
  });

  it('moves along the line, towards its end, to just clear of the label', () => {
    expect(besideLabel({ x: 100, y: 0 }, [0, 0, 200, 0], label, 10)).toEqual({ x: 140, y: 0 });
  });

  it('follows the line the other way when the end is under the label too', () => {
    expect(besideLabel({ x: 100, y: 0 }, [0, 0, 135, 0], label, 10)).toEqual({ x: 60, y: 0 });
  });

  it('finds no spot when the label covers the whole line', () => {
    expect(besideLabel({ x: 100, y: 0 }, [80, 0, 120, 0], label, 10)).toBeNull();
  });

  it('takes the longer of the two stretches the label leaves showing', () => {
    expect(besideLabel({ x: 100, y: 0 }, [0, 0, 300, 0], label, 10)).toEqual({ x: 140, y: 0 });
    expect(besideLabel({ x: 100, y: 0 }, [0, 0, 170, 0], label, 10)).toEqual({ x: 60, y: 0 });
  });

  it('keeps clear of each end by what stands there, the head and the end handle', () => {
    expect(besideLabel({ x: 100, y: 0 }, [0, 0, 200, 0], label, 10, [0, 70])).toEqual({ x: 60, y: 0 });
  });

  it('finds no spot when neither stretch is clear of its end', () => {
    expect(besideLabel({ x: 100, y: 0 }, [0, 0, 200, 0], label, 10, [65, 65])).toBeNull();
  });

  it('keeps to a curve, past its sample points', () => {
    const path = routePoints([0, 0, 100, -40, 200, 0], 'arc');
    const found = besideLabel({ x: 100, y: -40 }, path, { x: 70, y: -55, w: 60, h: 20 }, 5);
    expect(found).not.toBeNull();
    const at = found ?? { x: Number.NaN, y: Number.NaN };
    // Off the label's grown box, on its right edge or below it.
    expect(at.x >= 135 - 1e-9 || at.y >= -30 - 1e-9).toBe(true);
    expect(at.x).toBeGreaterThan(100);
    // On the drawn curve: within a sample's chord of it.
    const nearest = Math.min(
      ...Array.from({ length: path.length / 2 }, (_, i) => Math.hypot(path[i * 2] - at.x, path[i * 2 + 1] - at.y)),
    );
    expect(nearest).toBeLessThan(10);
  });
});

// What a handle beside the label keeps clear of at each end of the arrow:
// the end's handle, or its head when that reaches further, the gap, and its
// own radius.
describe('labelSpotEnds', () => {
  const arrow = (heads: Record<string, string>) => ({ id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0], ...heads }) as unknown as SceneElement;

  it('keeps clear of the end\'s arrowhead and only the start\'s handle, by default', () => {
    expect(labelSpotEnds(arrow({}), [0, 0, 200, 0], 5)).toEqual([15, 35]);
  });

  it('keeps clear of whichever heads the arrow has', () => {
    expect(labelSpotEnds(arrow({ startArrowhead: 'diamond', endArrowhead: 'none' }), [0, 0, 200, 0], 5)).toEqual([34, 15]);
  });
});
