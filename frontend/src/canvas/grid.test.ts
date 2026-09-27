import { describe, expect, it } from 'vitest';
import { gridDots, gridStep } from './grid';

const view = (zoom: number, pan = { x: 0, y: 0 }, width = 1440, height = 900) => ({ zoom, pan, width, height });

describe('gridStep', () => {
  it('keeps the drawing step while dots stand far enough apart on screen', () => {
    expect(gridStep(20, 1, 12)).toBe(20);
    expect(gridStep(20, 4, 12)).toBe(20);
    expect(gridStep(20, 0.6, 12)).toBe(20);
  });

  it('doubles the step until dots are at least the minimum gap apart on screen', () => {
    // 10px apart on screen: once doubled, 20px.
    expect(gridStep(20, 0.5, 12)).toBe(40);
    // 2px apart: doubled three times, 16px.
    expect(gridStep(20, 0.1, 12)).toBe(160);
  });

  it('never loops on a step or zoom of nothing', () => {
    expect(gridStep(0, 1, 12)).toBe(0);
    expect(gridStep(20, 0, 12)).toBe(0);
  });
});

describe('gridDots', () => {
  it('lists the dots on the drawing lattice that fall in the view', () => {
    const dots = gridDots(view(1, { x: 0, y: 0 }, 50, 30), 20, 12);
    expect(dots.xs).toEqual([0, 20, 40]);
    expect(dots.ys).toEqual([0, 20]);
    expect(dots.step).toBe(20);
  });

  it('follows the pan: the lattice stays on the drawing, not the screen', () => {
    // Panned 30px right: the scene's left edge is at -30.
    const dots = gridDots(view(1, { x: 30, y: -5 }, 50, 30), 20, 12);
    expect(dots.xs).toEqual([-20, 0, 20]);
    expect(dots.ys).toEqual([20]);
  });

  it('follows the zoom: at 2x the view covers half as much drawing', () => {
    const dots = gridDots(view(2, { x: 0, y: 0 }, 100, 60), 20, 12);
    expect(dots.xs).toEqual([0, 20, 40]);
    expect(dots.ys).toEqual([0, 20]);
  });

  it('thins the dots when zoomed far out rather than drawing thousands', () => {
    const far = gridDots(view(0.1), 20, 12);
    expect(far.step).toBe(160);
    // 16px apart on screen over 1440 x 900.
    expect(far.xs.length * far.ys.length).toBeLessThan(6000);
    for (const x of far.xs) expect(x % 160).toBe(0);
  });

  it('draws only a few hundred when zoomed far in', () => {
    const near = gridDots(view(4), 20, 12);
    expect(near.step).toBe(20);
    expect(near.xs.length * near.ys.length).toBeLessThan(250);
  });

  it('draws nothing for an empty view', () => {
    const none = gridDots(view(1, { x: 0, y: 0 }, 0, 0), 20, 12);
    expect(none.xs.length * none.ys.length).toBe(0);
  });
});
