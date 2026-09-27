/**
 * Whether a spatial index is needed. Times the per-move
 * work of snapping and attaching on a 2,000-element scene. Skipped by
 * default; run by hand with
 * `BAVA_BENCH=/path/to/results.json npx vitest run src/canvas/scale.bench.test.ts`,
 * which writes the times, in ms, to that file (the test runner hides
 * console output). The budget is 4 ms a move, a quarter of a 60 Hz frame.
 */
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import type { SceneData, SceneElement } from './scene';
import { targetAt } from './binding';
import { boxPoints, snapMove, snapPointer, snapReferences } from './snapping';

const COUNT = 2000;

/** A scene laid out as people draw: shapes on a loose grid, 60 to a row, and two long bars. */
function scene(): SceneData {
  const elements: SceneElement[] = [];
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < COUNT; i += 1) {
    const w = 60 + Math.round(random() * 120);
    const h = 40 + Math.round(random() * 80);
    elements.push({ id: `e${i}`, type: 'rect', x: (i % 60) * 220 + Math.round(random() * 20), y: Math.floor(i / 60) * 160, w, h, z: i + 1 } as SceneElement);
  }
  // Two bars across the whole board, a swim lane's edges: a side never
  // covered made gathering slow (239 ms), so they stay in.
  elements.push({ id: 'tall', type: 'rect', x: -60, y: 0, w: 20, h: 6000, z: COUNT + 1 } as SceneElement);
  elements.push({ id: 'wide', type: 'rect', x: 0, y: -60, w: 14000, h: 20, z: COUNT + 2 } as SceneElement);
  return { elements };
}

function time(run: () => void, times = 20): number {
  run();
  const start = performance.now();
  for (let i = 0; i < times; i += 1) run();
  return (performance.now() - start) / times;
}

describe.skipIf(!process.env.BAVA_BENCH)('a 2,000-element scene', () => {
  it('measures a move', () => {
    const data = scene();
    // Zoomed out to see everything, the worst case for snapping.
    const everything = null;
    // At zoom 1 on a 1440 by 900 window.
    const screen = { x: 0, y: 0, w: 1440, h: 900 };
    const moving = { x: 500, y: 500, w: 100, h: 60 };
    const results = {
      gatherAll: time(() => snapReferences(data, ['e0'], everything), 3),
      gatherScreen: time(() => snapReferences(data, ['e0'], screen)),
      moveAll: 0,
      moveScreen: 0,
      hoverAll: time(() => snapPointer(snapReferences(data, [], everything, false), { x: 503, y: 497 }, 8)),
      hoverScreen: time(() => snapPointer(snapReferences(data, [], screen, false), { x: 503, y: 497 }, 8)),
      targetAt: time(() => targetAt(data, { x: 503, y: 497 }, '', 10), 200),
      gapsAll: snapReferences(data, ['e0'], everything).gaps.length,
      gapsScreen: snapReferences(data, ['e0'], screen).gaps.length,
    };
    const all = snapReferences(data, ['e0'], everything);
    const onScreen = snapReferences(data, ['e0'], screen);
    results.moveAll = time(() => snapMove(all, boxPoints(moving), moving, 8));
    results.moveScreen = time(() => snapMove(onScreen, boxPoints(moving), moving, 8));
    writeFileSync(process.env.BAVA_BENCH!, JSON.stringify(results, null, 2));
    expect(results.gapsAll).toBeGreaterThan(0);
  });
});
