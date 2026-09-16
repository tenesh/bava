import { describe, expect, it } from 'vitest';
import { createViewport, MAX_ZOOM, MIN_ZOOM } from './viewport';

describe('viewport', () => {
  // Round-tripping is the property every other coordinate behaviour rests on.
  it('inverts itself at any zoom or pan', () => {
    const viewport = createViewport();
    for (const [zoom, panX, panY] of [
      [1, 0, 0],
      [2.5, -140, 80],
      [0.33, 900, -400],
    ] as const) {
      viewport.setZoom(zoom);
      viewport.setPan(panX, panY);
      for (const point of [
        { x: 0, y: 0 },
        { x: 137.5, y: -42.25 },
        { x: -1000, y: 2000 },
      ]) {
        const round = viewport.screenToScene(viewport.sceneToScreen(point));
        expect(round.x).toBeCloseTo(point.x, 6);
        expect(round.y).toBeCloseTo(point.y, 6);
      }
    }
  });

  // The property that makes zooming feel right, and the one that breaks
  // silently: whatever is under the cursor must stay under it.
  it('keeps the point under the cursor fixed while zooming', () => {
    const viewport = createViewport();
    const cursor = { x: 320, y: 210 };
    const sceneBefore = viewport.screenToScene(cursor);

    viewport.zoomAt(cursor, 2.4);

    const sceneAfter = viewport.screenToScene(cursor);
    expect(sceneAfter.x).toBeCloseTo(sceneBefore.x, 6);
    expect(sceneAfter.y).toBeCloseTo(sceneBefore.y, 6);
  });

  it('keeps the point fixed when zooming out too', () => {
    const viewport = createViewport();
    viewport.setZoom(3);
    const cursor = { x: 90, y: 640 };
    const before = viewport.screenToScene(cursor);
    viewport.zoomAt(cursor, 0.5);
    const after = viewport.screenToScene(cursor);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('clamps zoom', () => {
    const viewport = createViewport();
    viewport.setZoom(9999);
    expect(viewport.zoom).toBe(MAX_ZOOM);
    viewport.setZoom(0.0001);
    expect(viewport.zoom).toBe(MIN_ZOOM);
  });

  it('clamps when zooming about a point', () => {
    const viewport = createViewport();
    viewport.zoomAt({ x: 10, y: 10 }, 9999);
    expect(viewport.zoom).toBe(MAX_ZOOM);
  });

  it('pans by a delta', () => {
    const viewport = createViewport();
    viewport.panBy(20, -35);
    viewport.panBy(5, 5);
    expect(viewport.pan).toEqual({ x: 25, y: -30 });
  });
});
