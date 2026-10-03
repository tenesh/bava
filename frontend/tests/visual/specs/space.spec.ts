import { expect, test } from '@playwright/test';
import { THEMES, imagesLoaded, menu, menus, openApp, openSpace, restPointer, shot, shotFloating, shotPane, sidePane } from './helpers';

for (const theme of THEMES) {
  test.describe(`the side pane, ${theme}`, () => {
    test('the Files tree, a folder open', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.locator('[data-path="Marketing"]').click();
      await restPointer(page);
      await expect(page.locator('[data-path="Marketing/Launch plan.md"]')).toBeVisible();
      await shotPane(sidePane(page), shot('space', 'files', 'folder-open', theme));
    });

    test('the Files section folded', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.locator('.files-fold[data-section="files"]').click();
      await restPointer(page);
      await expect(page.locator('[data-path="Roadmap.md"]')).toHaveCount(0);
      await shotPane(sidePane(page), shot('space', 'files', 'folded', theme));
    });

    test('the Add menu', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      const add = page.locator('.files-button');
      await add.click();
      await expect(menus(page)).toHaveCount(1);
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, add, menus(page), shot('space', 'add-menu', 'open', theme));
    });

    test('naming a new page', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'file.new');
      await expect(page.locator('input.rename').filter({ visible: true })).toBeFocused();
      await shotPane(sidePane(page), shot('space', 'files', 'naming', theme));
    });

    test('the Media section', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      const rows = sidePane(page).locator('.media-row');
      await expect(rows).toHaveCount(9);
      await imagesLoaded(sidePane(page));
      await shotPane(sidePane(page), shot('space', 'media', 'section', theme));
      await sidePane(page).getByRole('searchbox', { name: 'Search files' }).fill('EXAMPLE');
      await expect(rows).toHaveCount(2);
      await shotPane(sidePane(page), shot('space', 'media', 'searching', theme));
    });

    test('the Media section folded', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.locator('.files-fold[data-section="media"]').click();
      await restPointer(page);
      await expect(sidePane(page).locator('.media-row')).toHaveCount(0);
      await shotPane(sidePane(page), shot('space', 'media', 'folded', theme));
    });

    test('the Space switcher', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      const switcher = page.locator('.bava-space-switcher');
      await switcher.click();
      await expect(menus(page)).toHaveCount(1);
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, switcher, menus(page), shot('space', 'switcher', 'open', theme));
    });
  });
}
