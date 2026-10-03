import { test } from '@playwright/test';
import { SCENES } from '../harness/canvas-scenes';
import { CANVAS_PAGE, THEMES, bringToCorner, canvasPane, openCanvas, restPointer, shot, shotPane, zoomSteps } from './helpers';

// What the canvas draws: each seeded scene, in both themes, at actual size and
// at about twice it (four steps in), its top-left corner in view, where
// strokes, heads, labels and code text show their detail.

const ZOOMS = [
  { name: '100', steps: 0 },
  { name: '200', steps: 4 },
] as const;

for (const theme of THEMES) {
  for (const [name, scene] of Object.entries(SCENES)) {
    test(`the canvas draws ${name}, ${theme}`, async ({ page }) => {
      await openCanvas(page, theme, CANVAS_PAGE, scene());
      for (const zoom of ZOOMS) {
        const scale = await zoomSteps(page, zoom.steps);
        if (zoom.steps > 0) await bringToCorner(page, { x: 90, y: 20 }, scale);
        // Off the canvas, so nothing on it shows as hovered.
        await restPointer(page);
        await shotPane(canvasPane(page), shot('canvas-look', name, zoom.name, theme));
      }
    });
  }
}
