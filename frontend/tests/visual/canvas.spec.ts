import { expect, test } from '@playwright/test';
import { ELEMENT_KINDS, FAMILIES, SCENES, elementScene, pictured, row, type Kind } from '../fixtures/canvas-scenes';
import {
  CANVAS_PAGE,
  THEMES,
  bringToCorner,
  canvasCursor,
  canvasPane,
  clickScene,
  codeEditor,
  dragScene,
  eraseAcross,
  expectEditing,
  labelEditor,
  menu,
  onScreen,
  openApp,
  openCanvas,
  openKinds,
  openPage,
  openZoomedOn,
  restPointer,
  selectTool,
  selectionToolbar,
  shot,
  shotPane,
  shotRegion,
  zoomSteps,
} from '../helpers';

// What the canvas draws, in both themes: each seeded scene of
// fixtures/canvas-scenes.ts, and each state that looks different (an element
// of each kind of chrome selected, a handle hovered, a label edited, a drag
// held). How a state is reached, and what it does to the file, is
// integration/canvas.spec.ts and the canvas's unit tests.

const AREA = 'canvas';

/** The scenes whose fine detail (strokes, heads) is also pictured at about twice actual size. */
const AT_TWICE: (keyof typeof SCENES)[] = ['styles', 'heads'];

/** One element of each kind of selection chrome. */
const SELECTED: Kind[] = ['rect', 'line-bent', 'arrow-straight', 'arrow-elbow', 'stroke', 'text', 'code', 'frame', 'group'];

/** A point of a scene clear of every cell, for a press on empty canvas. */
const EMPTY = { x: 900, y: 600 };

const ALL_KINDS = Object.keys(ELEMENT_KINDS) as Kind[];

for (const theme of THEMES) {
  test.describe(`the canvas draws, ${theme}`, () => {
    for (const [name, scene] of Object.entries(SCENES)) {
      test(name, async ({ page }) => {
        await openCanvas(page, theme, CANVAS_PAGE, scene());
        // Off the canvas, so nothing on it shows as hovered.
        await restPointer(page);
        await shotPane(canvasPane(page), shot(AREA, name, '100', theme));
        if (!AT_TWICE.includes(name as keyof typeof SCENES)) return;
        const scale = await zoomSteps(page, 4);
        await bringToCorner(page, { x: 90, y: 20 }, scale);
        await restPointer(page);
        await shotPane(canvasPane(page), shot(AREA, name, '200', theme));
      });
    }

    test('an empty canvas, with the tool rail and the zoom buttons', async ({ page }) => {
      await openCanvas(page, theme, CANVAS_PAGE, []);
      await restPointer(page);
      await expect(page.locator('footer')).toContainText('Nodes 0');
      await expect(selectTool(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator("[data-side='canvas'] .readout")).toHaveText('100%');
      await shotPane(canvasPane(page), shot(AREA, 'empty', 'rest', theme));
    });
  });

  test.describe(`the canvas's states, ${theme}`, () => {
    test('one element of each kind of chrome selected', async ({ page }) => {
      const scene = elementScene(SELECTED);
      await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
      for (const kind of SELECTED) {
        const cell = scene.cells[kind]!;
        await page.keyboard.press('Escape');
        await clickScene(page, cell.click);
        await restPointer(page);
        await expect(selectionToolbar(page)).toBeVisible();
        await shotRegion(page, cell.box, shot(AREA, kind, 'selected', theme));
      }
    });

    // A hover disc goes when the pointer leaves the canvas, even straight
    // from the handle it was drawn on: the picture is the arrow selected with
    // nothing hovered.
    test('a handle hovered as the pointer leaves the canvas is not left drawn', async ({ page }) => {
      const points = await openKinds(page, theme);
      // The arrow's middle: the click selects it and leaves the pointer on its middle handle.
      await clickScene(page, points.arrow);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      // Out of the canvas in one move, with no move over empty canvas between.
      await page.mouse.move(0, 0);
      await restPointer(page);
      await expect(selectionToolbar(page)).toBeVisible();
      await shotPane(canvasPane(page), shot(AREA, 'arrow', 'left-by-pointer', theme));
    });

    test('everything selected, with the toolbar', async ({ page }) => {
      // The page's own scene, as its file holds it.
      await openApp(page, theme);
      await openPage(page, CANVAS_PAGE);
      await menu(page, 'view.canvas');
      await menu(page, 'edit.selectAll');
      await restPointer(page);
      // Nodes counts what is on the canvas: three shapes and an arrow.
      await expect(page.locator('footer')).toContainText('Nodes 4');
      await expect(selectionToolbar(page)).toBeVisible();
      await shotPane(canvasPane(page), shot(AREA, 'selected', 'all', theme));
    });

    test('a handle hovered, at actual size and at about 200%', async ({ page }) => {
      const scene = elementScene(['rect']);
      const cell = scene.cells.rect!;
      await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
      await clickScene(page, cell.click);
      await expect(selectionToolbar(page)).toBeVisible();
      const at = await onScreen(page, cell.handle);
      await page.mouse.move(at.x, at.y);
      // The pointer is on the handle when the canvas shows that handle's cursor.
      await expect.poll(() => canvasCursor(page)).toBe(cell.cursor);
      await shotRegion(page, cell.box, shot(AREA, 'rect', 'handle', theme));
      const zoomed = await openZoomedOn(page, theme, 'rect');
      await clickScene(page, zoomed.cell.click, { zoom: zoomed.view });
      await expect(selectionToolbar(page)).toBeVisible();
      const near = await onScreen(page, zoomed.cell.handle, zoomed.view);
      await page.mouse.move(near.x, near.y);
      await expect.poll(() => canvasCursor(page)).toBe(zoomed.cell.cursor);
      await shotRegion(page, zoomed.cell.box, shot(AREA, 'rect', 'handle-200', theme), zoomed.view);
    });

    test('a turned shape selected', async ({ page }) => {
      const scene = elementScene(['rect'], { turned: true });
      await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
      await clickScene(page, scene.cells.rect!.click);
      await restPointer(page);
      await expect(selectionToolbar(page)).toBeVisible();
      await shotRegion(page, scene.cells.rect!.box, shot(AREA, 'rect', 'turned', theme));
    });

    test('labels too long for their elements', async ({ page }) => {
      const scene = elementScene(pictured('long', ALL_KINDS), { long: true });
      await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
      await restPointer(page);
      await shotRegion(page, scene.box, shot(AREA, 'labels', 'long', theme));
    });

    test('a label and a code block being edited', async ({ page }) => {
      const scene = elementScene(['rect', 'code']);
      await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
      for (const kind of ['rect', 'code'] as const) {
        const cell = scene.cells[kind]!;
        const at = await onScreen(page, cell.edit);
        await page.mouse.dblclick(at.x, at.y);
        await expectEditing(page, kind);
        await restPointer(page);
        await shotRegion(page, cell.box, shot(AREA, kind, 'editing', theme));
        await page.keyboard.press('Escape');
        await expect(labelEditor(page)).toBeHidden();
        await expect(codeEditor(page)).toBeHidden();
      }
    });

    test('arrows with an end bound to an element that is gone, and one selected', async ({ page }) => {
      const kinds = pictured('detached', FAMILIES.arrows);
      const scene = elementScene(kinds, { detached: true });
      await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
      await restPointer(page);
      await shotRegion(page, scene.box, shot(AREA, 'arrows', 'detached', theme));
      const cell = scene.cells['arrow-straight']!;
      await clickScene(page, cell.click);
      await restPointer(page);
      await expect(selectionToolbar(page)).toBeVisible();
      await shotRegion(page, cell.box, shot(AREA, 'arrow-straight', 'detached', theme));
    });

    test('shapes under the eraser, mid-drag', async ({ page }) => {
      const scene = elementScene(pictured('erasing', FAMILIES.shapes));
      await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
      await eraseAcross(page, scene, EMPTY);
      await shotRegion(page, scene.box, shot(AREA, 'shapes', 'erasing', theme));
      await page.mouse.up();
    });

    test('a marquee, mid-drag', async ({ page }) => {
      await openKinds(page, theme);
      await dragScene(page, { x: 70, y: 30 }, { x: 480, y: 160 }, { hold: true });
      await shotPane(canvasPane(page), shot(AREA, 'marquee', 'dragging', theme));
      await page.mouse.up();
    });

    test('rotating a shape', async ({ page }) => {
      const points = await openKinds(page, theme);
      await clickScene(page, points.shape);
      // The rotate handle: above the top edge's middle, by the rotate gap.
      await dragScene(page, { x: 170, y: 60 - 16 }, { x: 300, y: 60 }, { hold: true });
      await shotPane(canvasPane(page), shot(AREA, 'rotating', 'dragging', theme));
      await page.mouse.up();
    });

    test('editing a line’s points, one selected', async ({ page }) => {
      const points = await openKinds(page, theme);
      await clickScene(page, points.bent);
      await menu(page, 'canvas.editPoints');
      // The bend at the top of the line.
      await clickScene(page, { x: 580, y: 60 });
      await restPointer(page);
      // In point editing, the toolbar no longer offers it.
      await expect(selectionToolbar(page).getByRole('button', { name: 'Edit points' })).toHaveCount(0);
      await shotPane(canvasPane(page), shot(AREA, 'points', 'editing', theme));
    });

    test('snap guides while a ⌘ or Ctrl drag lines a box up', async ({ page }) => {
      await openCanvas(page, theme, CANVAS_PAGE, row());
      // The third box, dragged to sit level with the others, as far from the
      // second as the second is from the first.
      await dragScene(page, { x: 580, y: 200 }, { x: 560, y: 141 }, { modifiers: ['Control'], hold: true });
      await shotPane(canvasPane(page), shot(AREA, 'snapping', 'dragging', theme));
      await page.mouse.up();
      await page.keyboard.up('Control');
    });

    test('an arrow’s end over a shape, and near the middle of its edge', async ({ page }) => {
      await openKinds(page, theme);
      await page.keyboard.press('a');
      await dragScene(page, { x: 70, y: 420 }, { x: 205, y: 128 }, { hold: true });
      await shotPane(canvasPane(page), shot(AREA, 'arrow-end', 'over-shape', theme));
      // Just outside, near the middle of the bottom edge: the dot it snaps to.
      const near = await onScreen(page, { x: 170, y: 150 });
      await page.mouse.move(near.x, near.y, { steps: 4 });
      await shotPane(canvasPane(page), shot(AREA, 'arrow-end', 'near-middle', theme));
      await page.mouse.up();
    });
  });
}
