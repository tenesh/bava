import { expect, test } from '@playwright/test';
import { THEMES, menu, openApp, openPage, shot } from './helpers';

for (const theme of THEMES) {
  test.describe(`the canvas, ${theme}`, () => {
    test('everything selected, with the toolbar', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Engineering', 'Engineering/Architecture.md');
      await menu(page, 'view.canvas');
      await menu(page, 'edit.selectAll');
      await expect(page).toHaveScreenshot(shot('canvas', 'canvas', 'selected', theme));
    });
  });
}
