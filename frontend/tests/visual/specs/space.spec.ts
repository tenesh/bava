import { expect, test } from '@playwright/test';
import { THEMES, hovered, imagesLoaded, menu, menus, openApp, openSpace, restPointer, rightClick, shot, shotFloating, shotPane, sidePane, statusBar, statusMessage } from './helpers';

const RECENTS = [
  { path: '/Users/you/Documents/Acme Product', kind: 'space', openedAt: Date.UTC(2026, 8, 26) },
  { path: '/Users/you/Documents/Thesis', kind: 'space', openedAt: Date.UTC(2026, 8, 20) },
];

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

  test.describe(`the Files tree at work, ${theme}`, () => {
    for (const [what, path] of [
      ['page', 'Roadmap.md'],
      ['folder', 'Marketing'],
    ] as const) {
      test(`the right-click menu on a ${what}`, async ({ page }) => {
        await openApp(page, theme);
        await openSpace(page);
        const row = page.locator(`[data-path="${path}"]`);
        await rightClick(page, row);
        await expect(menus(page)).toHaveCount(1);
        await expect(menus(page).getByRole('menuitem', { name: 'Rename' })).toBeVisible();
        await restPointer(page);
        await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
        // The row the menu is for stays marked while it is open.
        await expect(row).toHaveAttribute('data-menu', '');
        await shotFloating(page, row, menus(page), shot('space', 'row-menu', what, theme));
      });
    }

    test('the right-click menu below the rows', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      // The tree's own room under its last row.
      const box = (await sidePane(page).locator('.space-tree .tree').boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height - 4, { button: 'right' });
      await expect(menus(page)).toHaveCount(1);
      await expect(menus(page).getByRole('menuitem')).toHaveText(['New page', 'New folder']);
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await expect(sidePane(page).locator('[data-menu]')).toHaveCount(0);
      await shotFloating(page, null, menus(page), shot('space', 'row-menu', 'empty', theme));
    });

    test('renaming a page, and a name another page has', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await rightClick(page, page.locator('[data-path="Roadmap.md"]'));
      await menus(page).getByRole('menuitem', { name: 'Rename' }).click();
      const field = page.locator('input.rename').filter({ visible: true });
      await expect(field).toBeFocused();
      await expect(field).toHaveValue('Roadmap');
      await restPointer(page);
      await shotPane(sidePane(page), shot('space', 'files', 'renaming', theme));
      await field.fill('Team handbook');
      await field.press('Enter');
      await expect(statusMessage(page)).toHaveText('Something with that name is already there.');
      await expect(page.locator('[data-path="Roadmap.md"]')).toBeVisible();
      await restPointer(page);
      await shotPane(statusBar(page), shot('space', 'files', 'name-taken', theme));
    });

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
      await shotPane(sidePane(page), shot('space', 'files', 'dropped', theme));
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

    test('the Space switcher with recent Spaces', async ({ page }) => {
      await openApp(page, theme, { 'bava.recents': JSON.stringify(RECENTS) });
      await openSpace(page);
      const switcher = page.locator('.bava-space-switcher');
      await switcher.click();
      await expect(menus(page).getByRole('menuitem', { name: /Thesis/ })).toBeVisible();
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, switcher, menus(page), shot('space', 'switcher', 'recents', theme));
    });
  });
}
