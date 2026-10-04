import { expect, test } from '@playwright/test';
import { AT_200, FAMILIES, elementScene, pictured, type Family, type Kind } from '../fixtures/canvas-scenes';
import {
  CANVAS_PAGE,
  THEMES,
  canvasCursor,
  clickScene,
  codeEditor,
  eraseAcross,
  expectEditing,
  labelEditor,
  menu,
  menus,
  onScreen,
  openCanvas,
  openZoomedOn,
  restPointer,
  selectionToolbar,
  shot,
  shotFloating,
  shotRegion,
} from '../helpers';

// Every kind of element the canvas draws (`harness/canvas-scenes.ts`,
// ELEMENT_KINDS), in every state it can be in (ELEMENT_STATES), in both
// themes: a family of kinds together where the state is the scene's, one
// kind's cell where the state is one element's. Each state pictures the kinds
// `pictured` gives it; `harness/canvas-elements.test.ts` fails on a kind or a
// state left without pictures and no reason.

const AREA = 'canvas-elements';

const families = Object.entries(FAMILIES) as [Family, readonly Kind[]][];

/** A point of the scene clear of every family's cells, for a click on empty canvas. */
const EMPTY = { x: 900, y: 600 };

for (const theme of THEMES) {
  test.describe(`every canvas element, ${theme}`, () => {
    for (const [family, members] of families) {
      test(`${family} at rest, then each selected`, async ({ page }) => {
        const scene = elementScene(pictured('rest', members));
        await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
        await restPointer(page);
        await expect(selectionToolbar(page)).toHaveCount(0);
        await shotRegion(page, scene.box, shot(AREA, family, 'rest', theme));
        for (const kind of pictured('selected', members)) {
          const cell = scene.cells[kind]!;
          await page.keyboard.press('Escape');
          await clickScene(page, cell.click);
          await restPointer(page);
          await expect(selectionToolbar(page)).toBeVisible();
          await shotRegion(page, cell.box, shot(AREA, kind, 'selected', theme));
        }
      });

      test(`${family}, each selected with a handle hovered`, async ({ page }) => {
        const scene = elementScene(members);
        await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
        for (const kind of pictured('handle', members)) {
          const cell = scene.cells[kind]!;
          await page.keyboard.press('Escape');
          await clickScene(page, cell.click);
          await expect(selectionToolbar(page)).toBeVisible();
          const at = await onScreen(page, cell.handle);
          await page.mouse.move(at.x, at.y);
          // The pointer is on the handle when the canvas shows that handle's cursor.
          await expect.poll(() => canvasCursor(page)).toBe(cell.cursor);
          await shotRegion(page, cell.box, shot(AREA, kind, 'handle', theme));
        }
      });

      test(`${family} locked: Select All selects none of them`, async ({ page }) => {
        const scene = elementScene(pictured('locked', members), { locked: true });
        await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
        await clickScene(page, EMPTY);
        await menu(page, 'edit.selectAll');
        await restPointer(page);
        await expect(selectionToolbar(page)).toHaveCount(0);
        await shotRegion(page, scene.box, shot(AREA, family, 'locked', theme));
        if (family !== 'shapes') return;
        // The one way back: Unlock All, offered on empty canvas.
        await clickScene(page, EMPTY, { button: 'right' });
        await expect(menus(page)).toHaveCount(1);
        await expect(menus(page).getByRole('menuitem', { name: /unlock all/i })).toBeVisible();
        await restPointer(page);
        await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
        await shotFloating(page, null, menus(page), shot(AREA, 'locked', 'menu', theme));
      });

      test(`${family} turned, then each selected`, async ({ page }) => {
        const scene = elementScene(pictured('turned', members), { turned: true });
        await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
        await restPointer(page);
        await shotRegion(page, scene.box, shot(AREA, family, 'turned', theme));
        for (const kind of pictured('turned', members)) {
          const cell = scene.cells[kind]!;
          await page.keyboard.press('Escape');
          await clickScene(page, cell.click);
          await restPointer(page);
          await expect(selectionToolbar(page)).toBeVisible();
          await shotRegion(page, cell.box, shot(AREA, kind, 'turned', theme));
        }
      });

      if (pictured('long', members).length > 0) {
        test(`${family} with labels too long for them`, async ({ page }) => {
          const scene = elementScene(pictured('long', members), { long: true });
          await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
          await restPointer(page);
          await shotRegion(page, scene.box, shot(AREA, family, 'long', theme));
        });
      }

      if (pictured('editing', members).length > 0) {
        test(`${family}, each with its text being edited`, async ({ page }) => {
          const scene = elementScene(members);
          await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
          for (const kind of pictured('editing', members)) {
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
      }

      test(`${family} under the eraser, mid-drag`, async ({ page }) => {
        const scene = elementScene(pictured('erasing', members));
        await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
        await eraseAcross(page, scene, EMPTY);
        await shotRegion(page, scene.box, shot(AREA, family, 'erasing', theme));
        await page.mouse.up();
      });
    }

    test('arrows with an end bound to an element that is gone, then each selected', async ({ page }) => {
      const kinds = pictured('detached', FAMILIES.arrows);
      const scene = elementScene(kinds, { detached: true });
      await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
      await restPointer(page);
      await shotRegion(page, scene.box, shot(AREA, 'arrows', 'detached', theme));
      for (const kind of kinds) {
        const cell = scene.cells[kind]!;
        await page.keyboard.press('Escape');
        await clickScene(page, cell.click);
        await restPointer(page);
        await expect(selectionToolbar(page)).toBeVisible();
        await shotRegion(page, cell.box, shot(AREA, kind, 'detached', theme));
      }
    });

    for (const kind of AT_200.handle) {
      test(`${kind} selected with a handle hovered, at about 200%`, async ({ page }) => {
        const { cell, view } = await openZoomedOn(page, theme, kind);
        await clickScene(page, cell.click, { zoom: view });
        await expect(selectionToolbar(page)).toBeVisible();
        const at = await onScreen(page, cell.handle, view);
        await page.mouse.move(at.x, at.y);
        await expect.poll(() => canvasCursor(page)).toBe(cell.cursor);
        await shotRegion(page, cell.box, shot(AREA, kind, 'handle-200', theme), view);
      });
    }

    for (const kind of AT_200.editing) {
      test(`${kind} with its text being edited, at about 200%`, async ({ page }) => {
        const { cell, view } = await openZoomedOn(page, theme, kind);
        const at = await onScreen(page, cell.edit, view);
        await page.mouse.dblclick(at.x, at.y);
        await expectEditing(page, kind);
        await restPointer(page);
        await shotRegion(page, cell.box, shot(AREA, kind, 'editing-200', theme), view);
      });
    }
  });
}
