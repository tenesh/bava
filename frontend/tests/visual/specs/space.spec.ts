import { expect, test } from '@playwright/test';
import { THEMES, menu, openApp, openSpace, shot } from './helpers';

const sidePane = (page: import('@playwright/test').Page) => page.locator('.region-files');

for (const theme of THEMES) {
  test.describe(`the side pane, ${theme}`, () => {
    test('the Files tree, a folder open', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.locator('[data-path="Marketing"]').click();
      await expect(page.locator('[data-path="Marketing/Launch plan.md"]')).toBeVisible();
      await expect(sidePane(page)).toHaveScreenshot(shot('space', 'files', 'folder-open', theme));
    });

    test('the Files section folded', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.locator('.files-fold[data-section="files"]').click();
      await expect(page.locator('[data-path="Roadmap.md"]')).toHaveCount(0);
      await expect(sidePane(page)).toHaveScreenshot(shot('space', 'files', 'folded', theme));
    });

    test('the Add menu', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.locator('.files-button').click();
      await expect(page.locator('.bava-menu').filter({ visible: true })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('space', 'files', 'add-menu', theme));
    });

    test('naming a new page', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'file.new');
      await expect(page.locator('input.rename').filter({ visible: true })).toBeFocused();
      await expect(sidePane(page)).toHaveScreenshot(shot('space', 'files', 'naming', theme));
    });

    test('the Media section', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      const rows = sidePane(page).locator('.media-row');
      await expect(rows).toHaveCount(9);
      await expect(rows.filter({ hasText: 'logo.png' }).locator('img')).toHaveJSProperty('complete', true);
      await expect(sidePane(page)).toHaveScreenshot(shot('space', 'media', 'section', theme));
      await sidePane(page).getByRole('searchbox', { name: 'Search files' }).fill('EXAMPLE');
      await expect(rows).toHaveCount(2);
      await expect(sidePane(page)).toHaveScreenshot(shot('space', 'media', 'searching', theme));
    });

    test('the Media section folded', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.locator('.files-fold[data-section="media"]').click();
      await expect(sidePane(page).locator('.media-row')).toHaveCount(0);
      await expect(sidePane(page)).toHaveScreenshot(shot('space', 'media', 'folded', theme));
    });

    test('the Space switcher', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.locator('.bava-space-switcher').click();
      await expect(page.locator('.bava-menu').filter({ visible: true })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('space', 'switcher', 'open', theme));
    });
  });
}
