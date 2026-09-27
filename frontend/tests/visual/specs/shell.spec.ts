import { expect, test } from '@playwright/test';
import { THEMES, menu, openApp, openPage, openSpace, shot } from './helpers';

for (const theme of THEMES) {
  test.describe(`the main window, ${theme}`, () => {
    test('a Space open, a page in Both', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing', 'Marketing/Launch plan.md');
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'both', theme));
    });

    test('the Document view', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing', 'Marketing/Launch plan.md');
      await menu(page, 'view.document');
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'document', theme));
    });

    test('the Canvas view, with shapes on the dot grid', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Engineering', 'Engineering/Architecture.md');
      await menu(page, 'view.canvas');
      // Nodes counts what is on the canvas: three shapes and an arrow.
      await expect(page.locator('footer')).toContainText('Nodes 4');
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'canvas', theme));
    });

    test('no page open in a Space', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'no-page', theme));
    });
  });
}
