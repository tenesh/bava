import { expect, test, type Page } from '@playwright/test';
import { kinds, row } from '../harness/canvas-scenes';
import { THEMES, menu, onScreen, openCanvas, openDialog, shot, type Theme } from './helpers';

// What the canvas shows while something is selected, dragged or edited, and
// every picker, menu and dialog it opens, in both themes.

const PAGE = 'Engineering/Architecture.md';
const pane = (page: Page) => page.locator("[data-side='canvas']");
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Selection' });
const visibleMenus = (page: Page) => page.locator('.bava-menu').filter({ visible: true });

/** A point of the scene on screen, at actual size. */
const at = (page: Page, point: { x: number; y: number }) => onScreen(page, point, 1);

async function click(page: Page, point: { x: number; y: number }, options: { button?: 'right' } = {}) {
  const screen = await at(page, point);
  await page.mouse.click(screen.x, screen.y, options);
}

/** The pointer parked on empty canvas, so nothing shows as hovered. */
async function rest(page: Page) {
  const screen = await at(page, { x: 950, y: 480 });
  await page.mouse.move(screen.x, screen.y);
}

const popovers = (page: Page) => page.locator('.bava-control-popover, .bava-style-popover').filter({ visible: true });

/** A drag in steps, held before the release for a picture of it under way. */
async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const a = await at(page, from);
  const b = await at(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
}

/** A short name for a control's label, for the reference's file name. */
const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function openKinds(page: Page, theme: Theme) {
  const scene = kinds();
  await openCanvas(page, theme, PAGE, scene.elements);
  return scene.click;
}

for (const theme of THEMES) {
  test.describe(`the canvas's states, ${theme}`, () => {
    test('each kind selected', async ({ page }) => {
      const points = await openKinds(page, theme);
      for (const [kind, point] of Object.entries(points)) {
        await page.keyboard.press('Escape');
        await click(page, point);
        await rest(page);
        await expect(toolbar(page)).toBeVisible();
        await expect(pane(page)).toHaveScreenshot(shot('canvas-states', 'selected', kind, theme));
      }
    });

    test('a marquee, then several selected', async ({ page }) => {
      await openKinds(page, theme);
      await dragTo(page, { x: 70, y: 30 }, { x: 480, y: 160 });
      await expect(pane(page)).toHaveScreenshot(shot('canvas-states', 'marquee', 'dragging', theme));
      await page.mouse.up();
      await expect(pane(page)).toHaveScreenshot(shot('canvas-states', 'selected', 'several', theme));
    });

    test('rotating a shape', async ({ page }) => {
      const points = await openKinds(page, theme);
      await click(page, points.shape);
      // The rotate handle: above the top edge's middle, by the rotate gap.
      await dragTo(page, { x: 170, y: 60 - 16 }, { x: 300, y: 60 });
      await expect(pane(page)).toHaveScreenshot(shot('canvas-states', 'rotating', 'dragging', theme));
      await page.mouse.up();
    });

    test('editing a line’s points, one selected', async ({ page }) => {
      const points = await openKinds(page, theme);
      await click(page, points.bent);
      await menu(page, 'canvas.editPoints');
      // The bend at the top of the line.
      await click(page, { x: 580, y: 60 });
      await rest(page);
      await expect(pane(page)).toHaveScreenshot(shot('canvas-states', 'points', 'editing', theme));
    });

    test('snap guides while a ⌘ or Ctrl drag lines a box up', async ({ page }) => {
      await openCanvas(page, theme, PAGE, row());
      await page.keyboard.down('Control');
      // The third box, dragged to sit level with the others, as far from the
      // second as the second is from the first.
      await dragTo(page, { x: 580, y: 200 }, { x: 560, y: 141 });
      await expect(pane(page)).toHaveScreenshot(shot('canvas-states', 'snapping', 'dragging', theme));
      await page.mouse.up();
      await page.keyboard.up('Control');
    });

    test('an arrow’s end over a shape', async ({ page }) => {
      await openKinds(page, theme);
      await page.keyboard.press('a');
      await dragTo(page, { x: 70, y: 420 }, { x: 205, y: 128 });
      await expect(pane(page)).toHaveScreenshot(shot('canvas-states', 'arrow-end', 'over-shape', theme));
      // Just outside, near the middle of the bottom edge: the dot it snaps to.
      const near = await at(page, { x: 170, y: 150 });
      await page.mouse.move(near.x, near.y, { steps: 4 });
      await expect(pane(page)).toHaveScreenshot(shot('canvas-states', 'arrow-end', 'near-middle', theme));
      await page.mouse.up();
    });

    for (const kind of ['shape', 'arrow'] as const) {
      test(`every picker of a selected ${kind}`, async ({ page }) => {
        const points = await openKinds(page, theme);
        await click(page, points[kind]);
        await rest(page);
        const triggers = toolbar(page).locator('.bava-style-trigger, .bava-control-trigger');
        const count = await triggers.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; i += 1) {
          const label = (await triggers.nth(i).getAttribute('aria-label')) ?? `picker-${i}`;
          await triggers.nth(i).click();
          await expect(popovers(page)).toBeVisible();
          // What is in effect shows as chosen, a default too. Read from the
          // page: headless WebKit can leave a popover painted as it first
          // appeared after its rows' state has changed.
          const options = popovers(page).locator('.bava-option');
          if ((await options.count()) > 0) await expect(options.and(page.locator('[data-state="checked"]'))).toHaveCount(1);
          await expect(page).toHaveScreenshot(shot('canvas-states', `picker-${kind}`, slug(label), theme));
          await page.keyboard.press('Escape');
          await expect(popovers(page)).toHaveCount(0);
        }
      });
    }

    test('the toolbar’s More menu', async ({ page }) => {
      const points = await openKinds(page, theme);
      await click(page, points.shape);
      await toolbar(page).getByRole('button', { name: 'More actions' }).click();
      await expect(visibleMenus(page)).toBeVisible();
      await expect(page).toHaveScreenshot(shot('canvas-states', 'more', 'open', theme));
    });

    test('the right-click menu and each submenu', async ({ page }) => {
      const points = await openKinds(page, theme);
      await click(page, points.shape, { button: 'right' });
      await expect(visibleMenus(page)).toBeVisible();
      await expect(page).toHaveScreenshot(shot('canvas-states', 'context-menu', 'open', theme));
      const labels = await visibleMenus(page).first().locator('[data-part="trigger-item"]').allInnerTexts();
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
        await expect(visibleMenus(page)).toHaveCount(0);
        await click(page, points.shape, { button: 'right' });
        const trigger = visibleMenus(page).first().locator('[data-part="trigger-item"]', { hasText: label });
        await expect(visibleMenus(page)).toBeVisible();
        // Down a row at a time, each step waiting for the highlight to move.
        const highlighted = visibleMenus(page).first().locator('[data-highlighted]');
        await expect(async () => {
          await page.keyboard.press('Home');
          await expect(highlighted).toHaveCount(1, { timeout: 500 });
        }).toPass({ timeout: 5000 });
        for (let step = 0; step < 20 && (await trigger.getAttribute('data-highlighted')) === null; step += 1) {
          const before = await highlighted.innerText();
          await page.keyboard.press('ArrowDown');
          await expect(highlighted).not.toHaveText(before);
        }
        // Pressed again if the menu was not yet ready for it, as a person would.
        await expect(async () => {
          await page.keyboard.press('ArrowRight');
          await expect(visibleMenus(page)).toHaveCount(2, { timeout: 500 });
        }).toPass({ timeout: 5000 });
        await expect(trigger).toHaveAttribute('data-highlighted', '');
        if (theme === 'dark') await expect(page).toHaveScreenshot(shot('canvas-states', 'context-menu', slug(label), theme));
      }
    });

    test('the insert panel, searching', async ({ page }) => {
      await openKinds(page, theme);
      await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Insert', exact: true }).click();
      const panel = page.getByRole('dialog', { name: 'Insert item' });
      await expect(panel).toBeVisible();
      await page.keyboard.type('cyl');
      await expect(page).toHaveScreenshot(shot('canvas-states', 'insert', 'searching', theme));
    });

    test('exporting a selection', async ({ page }) => {
      const points = await openKinds(page, theme);
      await click(page, points.shape);
      await menu(page, 'canvas.exportSelection');
      await expect(openDialog(page)).toBeVisible();
      await expect(page).toHaveScreenshot(shot('canvas-states', 'export', 'selection', theme));
    });

    for (const engine of ['Dagre', 'ELK']) {
      test(`Diagram from Code, with ${engine}`, async ({ page }) => {
        await openKinds(page, theme);
        await menu(page, 'insert.diagram');
        await expect(openDialog(page).locator('.cm-content')).toBeFocused();
        await openDialog(page).getByText(engine, { exact: true }).click();
        await expect(openDialog(page).getByRole('radiogroup', { name: 'Direction' })).toBeVisible();
        await openDialog(page).locator('.cm-content').focus();
        // The preview, once the code has been laid out with the engine.
        await expect(openDialog(page).locator('.bava-diagram-preview svg')).toBeVisible();
        await expect(page).toHaveScreenshot(shot('canvas-states', 'diagram', engine.toLowerCase(), theme));
      });
    }
  });
}
