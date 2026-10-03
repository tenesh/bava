import { expect, test } from '@playwright/test';
import { THEMES, imagesLoaded, menu, openApp, openPage, openSpace, restPointer, shot, sidePane } from './helpers';

for (const theme of THEMES) {
  test.describe(`the main window, ${theme}`, () => {
    test('a Space open, a page in Both', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing/Launch plan.md');
      await restPointer(page);
      await imagesLoaded(sidePane(page));
      await expect(page.locator('[data-side="document"]')).toBeVisible();
      await expect(page.locator("[data-side='canvas']")).toBeVisible();
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'both', theme));
    });

    test('the Document view', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing/Launch plan.md');
      await menu(page, 'view.document');
      await restPointer(page);
      await imagesLoaded(sidePane(page));
      await expect(page.locator("[data-side='canvas']")).toBeHidden();
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'document', theme));
    });

    test('the Canvas view, with shapes on the dot grid', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Engineering/Architecture.md');
      await menu(page, 'view.canvas');
      await restPointer(page);
      await imagesLoaded(sidePane(page));
      // Nodes counts what is on the canvas: three shapes and an arrow.
      await expect(page.locator('footer')).toContainText('Nodes 4');
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'canvas', theme));
    });

    test('no page open in a Space', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await restPointer(page);
      await imagesLoaded(sidePane(page));
      await expect(page.getByText('Pick a page in Files, or make a new one.')).toBeVisible();
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'no-page', theme));
    });
  });
}
