import { expect, test } from '@playwright/test';
import { THEMES, hovered, imagesLoaded, openApp, openSpace, restPointer, shot, shotPane, sidePane } from '../helpers';

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

    test('the Media section', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      const rows = sidePane(page).locator('.media-row');
      await expect(rows).toHaveCount(9);
      await imagesLoaded(sidePane(page));
      await shotPane(sidePane(page), shot('space', 'media', 'section', theme));
      await sidePane(page).getByRole('searchbox', { name: 'Search files' }).fill('EXAMPLE');
      await expect(rows).toHaveCount(2);
    });

    test('the Media section folded', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.locator('.files-fold[data-section="media"]').click();
      await restPointer(page);
      await expect(sidePane(page).locator('.media-row')).toHaveCount(0);
      await shotPane(sidePane(page), shot('space', 'media', 'folded', theme));
    });

  });

  test.describe(`the Files tree at work, ${theme}`, () => {
    test('a page dragged onto a folder, and dropped in it', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      const roadmap = page.locator('[data-path="Roadmap.md"]');
      const marketing = page.locator('[data-path="Marketing"]');
      const from = (await roadmap.boundingBox())!;
      const to = (await marketing.boundingBox())!;
      await page.mouse.move(from.x + 40, from.y + from.height / 2);
      await page.mouse.down();
      // The folder's middle: inside it, not before or after.
      await page.mouse.move(to.x + 40, to.y + to.height / 2, { steps: 8 });
      await expect(marketing).toHaveAttribute('data-drop', 'inside');
      await shotPane(sidePane(page), shot('space', 'files', 'dragging-into', theme));
      await page.mouse.up();
      await expect(roadmap).toHaveCount(0);
      if (!(await page.locator('[data-path="Marketing/Roadmap.md"]').isVisible())) await marketing.click();
      await expect(page.locator('[data-path="Marketing/Roadmap.md"]')).toBeVisible();
      // Headless WebKit leaves a row it was dragged across showing as hovered
      // until the pointer next crosses it.
      const handbook = page.locator('[data-path="Team handbook.md"]');
      await handbook.hover();
      await restPointer(page);
      expect(await hovered(handbook)).toBe(false);
    });

    test('a page dragged between two others', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      const handbook = page.locator('[data-path="Team handbook.md"]');
      const roadmap = page.locator('[data-path="Roadmap.md"]');
      const from = (await handbook.boundingBox())!;
      const to = (await roadmap.boundingBox())!;
      await page.mouse.move(from.x + 40, from.y + from.height / 2);
      await page.mouse.down();
      // The top quarter of the row: before it.
      await page.mouse.move(to.x + 40, to.y + 3, { steps: 8 });
      await expect(roadmap).toHaveAttribute('data-drop', 'before');
      await shotPane(sidePane(page), shot('space', 'files', 'dragging-between', theme));
      await page.mouse.up();
      await expect(sidePane(page).locator('.space-tree .row .name')).toHaveText(['Marketing', 'Engineering', 'Team handbook', 'Roadmap']);
    });

  });
}
