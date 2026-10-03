import { expect, test } from '@playwright/test';
import { row } from '../harness/canvas-scenes';
import {
  CANVAS_PAGE,
  THEMES,
  canvasPane,
  clickScene,
  dragScene,
  menu,
  menus,
  onScreen,
  openCanvas,
  openApp,
  openDialog,
  openKinds,
  openPage,
  popovers,
  restPointer,
  selectionToolbar,
  shot,
  shotDialog,
  shotFloating,
  shotPane,
  slug,
} from './helpers';

// What the canvas shows while something is selected, dragged or edited, and
// every picker, menu and dialog it opens, in both themes.

for (const theme of THEMES) {
  test.describe(`the canvas's states, ${theme}`, () => {
    test('each kind selected', async ({ page }) => {
      const points = await openKinds(page, theme);
      for (const [kind, point] of Object.entries(points)) {
        await page.keyboard.press('Escape');
        await clickScene(page, point);
        await restPointer(page);
        await expect(selectionToolbar(page)).toBeVisible();
        await shotPane(canvasPane(page), shot('canvas-states', 'selected', kind, theme));
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
      await shotPane(canvasPane(page), shot('canvas-states', 'selected', 'arrow', theme));
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
      await shotPane(canvasPane(page), shot('canvas-states', 'selected', 'all', theme));
    });

    test('a marquee, then several selected', async ({ page }) => {
      await openKinds(page, theme);
      await dragScene(page, { x: 70, y: 30 }, { x: 480, y: 160 }, { hold: true });
      await shotPane(canvasPane(page), shot('canvas-states', 'marquee', 'dragging', theme));
      await page.mouse.up();
      await restPointer(page);
      await expect(selectionToolbar(page)).toBeVisible();
      await shotPane(canvasPane(page), shot('canvas-states', 'selected', 'several', theme));
    });

    test('rotating a shape', async ({ page }) => {
      const points = await openKinds(page, theme);
      await clickScene(page, points.shape);
      // The rotate handle: above the top edge's middle, by the rotate gap.
      await dragScene(page, { x: 170, y: 60 - 16 }, { x: 300, y: 60 }, { hold: true });
      await shotPane(canvasPane(page), shot('canvas-states', 'rotating', 'dragging', theme));
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
      await shotPane(canvasPane(page), shot('canvas-states', 'points', 'editing', theme));
    });

    test('snap guides while a ⌘ or Ctrl drag lines a box up', async ({ page }) => {
      await openCanvas(page, theme, CANVAS_PAGE, row());
      // The third box, dragged to sit level with the others, as far from the
      // second as the second is from the first.
      await dragScene(page, { x: 580, y: 200 }, { x: 560, y: 141 }, { modifiers: ['Control'], hold: true });
      await shotPane(canvasPane(page), shot('canvas-states', 'snapping', 'dragging', theme));
      await page.mouse.up();
      await page.keyboard.up('Control');
    });

    test('an arrow’s end over a shape', async ({ page }) => {
      await openKinds(page, theme);
      await page.keyboard.press('a');
      await dragScene(page, { x: 70, y: 420 }, { x: 205, y: 128 }, { hold: true });
      await shotPane(canvasPane(page), shot('canvas-states', 'arrow-end', 'over-shape', theme));
      // Just outside, near the middle of the bottom edge: the dot it snaps to.
      const near = await onScreen(page, { x: 170, y: 150 });
      await page.mouse.move(near.x, near.y, { steps: 4 });
      await shotPane(canvasPane(page), shot('canvas-states', 'arrow-end', 'near-middle', theme));
      await page.mouse.up();
    });

    for (const kind of ['shape', 'arrow'] as const) {
      test(`every picker of a selected ${kind}`, async ({ page }) => {
        const points = await openKinds(page, theme);
        await clickScene(page, points[kind]);
        const triggers = selectionToolbar(page).locator('.bava-style-trigger, .bava-control-trigger');
        const count = await triggers.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i += 1) {
          const label = (await triggers.nth(i).getAttribute('aria-label')) ?? `picker-${i}`;
          await triggers.nth(i).click();
          await expect(popovers(page)).toBeVisible();
          await restPointer(page);
          // What is in effect shows as chosen, a default too. Read from the
          // page: headless WebKit can leave a popover painted as it first
          // appeared after its rows' state has changed.
          const options = popovers(page).locator('.bava-option');
          if ((await options.count()) > 0) await expect(options.and(page.locator('[data-state="checked"]'))).toHaveCount(1);
          await shotFloating(page, triggers.nth(i), popovers(page), shot('canvas-states', `picker-${kind}`, slug(label), theme));
          await page.keyboard.press('Escape');
          await expect(popovers(page)).toHaveCount(0);
        }
      });
    }

    test('the toolbar’s More menu', async ({ page }) => {
      const points = await openKinds(page, theme);
      await clickScene(page, points.shape);
      const more = selectionToolbar(page).getByRole('button', { name: 'More actions' });
      await more.click();
      await expect(menus(page)).toHaveCount(1);
      await restPointer(page);
      // Opened by a click: no row is highlighted until the pointer or a key moves to one.
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, more, menus(page), shot('canvas-states', 'more', 'open', theme));
    });

    test('the right-click menu and each submenu', async ({ page }) => {
      const points = await openKinds(page, theme);
      await clickScene(page, points.shape, { button: 'right' });
      await expect(menus(page)).toHaveCount(1);
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, null, menus(page), shot('canvas-states', 'context-menu', 'open', theme));
      const labels = await menus(page).first().locator('[data-part="trigger-item"]').allInnerTexts();
      expect(labels.length).toBeGreaterThan(0);
      // Each from a fresh menu, opened from the keyboard: by pointer, Ark
      // holds a submenu shut a moment while the pointer may be heading into
      // another one it crossed, which makes a resting pointer's picture
      // depend on timing. Moving between submenus by hand is checked by hand.
      // In light, headless WebKit keeps painting the menu as it was before the
      // keys moved its highlight, though every computed style has changed
      // (checked below), so these are pictured in dark; light's is checked
      // by hand.
      for (const label of labels.map((text) => text.trim())) {
        await page.keyboard.press('Escape');
        await expect(menus(page)).toHaveCount(0);
        await clickScene(page, points.shape, { button: 'right' });
        await restPointer(page);
        const trigger = menus(page).first().locator('[data-part="trigger-item"]', { hasText: label });
        await expect(menus(page)).toBeVisible();
        // Down a row at a time, each step waiting for the highlight to move.
        const highlighted = menus(page).first().locator('[data-highlighted]');
        // Pressed again while the menu has not yet taken focus: it takes it a
        // moment after it shows, and a key before then goes to the canvas.
        await expect(async () => {
          await page.keyboard.press('Home');
          await expect(highlighted).toHaveCount(1, { timeout: 500 });
        }).toPass({ timeout: 5000 });
        for (let step = 0; step < 20 && (await trigger.getAttribute('data-highlighted')) === null; step += 1) {
          const before = await highlighted.innerText();
          await page.keyboard.press('ArrowDown');
          await expect(highlighted).not.toHaveText(before);
        }
        await page.keyboard.press('ArrowRight');
        await expect(menus(page)).toHaveCount(2);
        await expect(trigger).toHaveAttribute('data-highlighted', '');
        if (theme === 'dark') await shotFloating(page, null, menus(page), shot('canvas-states', 'context-menu', slug(label), theme));
      }
    });

    test('the insert panel, searching', async ({ page }) => {
      await openKinds(page, theme);
      // By what it is, not its name: once the panel opens it becomes Close.
      const insert = page.getByRole('toolbar', { name: 'Tools' }).locator('[data-insert-trigger]');
      await insert.click();
      const panel = page.getByRole('dialog', { name: 'Insert item' });
      await expect(panel).toBeVisible();
      await page.keyboard.type('cyl');
      await restPointer(page);
      await expect(panel.getByRole('combobox')).toHaveValue('cyl');
      await expect(panel.getByRole('option', { name: /cylinder/i }).first()).toBeVisible();
      await shotFloating(page, insert, panel, shot('canvas-states', 'insert', 'searching', theme));
    });

    test('exporting a selection', async ({ page }) => {
      const points = await openKinds(page, theme);
      await clickScene(page, points.shape);
      await menu(page, 'canvas.exportSelection');
      await expect(openDialog(page).locator('.bava-export-preview svg')).toBeVisible();
      await shotDialog(page, shot('canvas-states', 'export', 'selection', theme));
    });

    for (const engine of ['Dagre', 'ELK']) {
      test(`Diagram from Code, with ${engine}`, async ({ page }) => {
        await openKinds(page, theme);
        await menu(page, 'insert.diagram');
        await expect(openDialog(page).locator('.cm-content')).toBeFocused();
        await openDialog(page).getByText(engine, { exact: true }).click();
        await expect(openDialog(page).getByRole('radio', { name: engine })).toBeChecked();
        await expect(openDialog(page).getByRole('radiogroup', { name: 'Direction' })).toBeVisible();
        await openDialog(page).locator('.cm-content').focus();
        await restPointer(page);
        // The preview, once the code has been laid out with the engine.
        await expect(openDialog(page).locator('.bava-diagram-preview svg')).toBeVisible();
        await shotDialog(page, shot('canvas-states', 'diagram', engine.toLowerCase(), theme));
      });
    }
  });
}
