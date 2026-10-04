import { expect, test } from '@playwright/test';
import { menu, menus, openApp, openSpace, restPointer, rightClick, sidePane, statusMessage } from '../helpers';

const RECENTS = [
  { path: '/Users/you/Documents/Acme Product', kind: 'space', openedAt: Date.UTC(2026, 8, 26) },
  { path: '/Users/you/Documents/Thesis', kind: 'space', openedAt: Date.UTC(2026, 8, 20) },
];

// The side pane as a person works in it: what its menus offer, the switcher,
// naming and renaming, searching Media, a page dropped into a folder, and a
// folder folded.

test.describe('the side pane at work', () => {
  test('the Add menu', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    const add = page.locator('.files-button');
    await add.click();
    await expect(menus(page)).toHaveCount(1);
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
  });

  test('naming a new page', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'file.new');
    await expect(page.locator('input.rename').filter({ visible: true })).toBeFocused();
  });

  test('the Space switcher', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    const switcher = page.locator('.bava-space-switcher');
    await switcher.click();
    await expect(menus(page)).toHaveCount(1);
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
  });

  test('the right-click menu below the rows', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    // The tree's own room under its last row.
    const box = (await sidePane(page).locator('.space-tree .tree').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 4, { button: 'right' });
    await expect(menus(page)).toHaveCount(1);
    await expect(menus(page).getByRole('menuitem')).toHaveText(['New page', 'New folder']);
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
    await expect(sidePane(page).locator('[data-menu]')).toHaveCount(0);
  });

  test('renaming a page, and a name another page has', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await rightClick(page, page.locator('[data-path="Roadmap.md"]'));
    await menus(page).getByRole('menuitem', { name: 'Rename' }).click();
    const field = page.locator('input.rename').filter({ visible: true });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('Roadmap');
    await restPointer(page);
    await field.fill('Team handbook');
    await field.press('Enter');
    await expect(statusMessage(page)).toHaveText('Something with that name is already there.');
    await expect(page.locator('[data-path="Roadmap.md"]')).toBeVisible();
  });

  test('the Space switcher with recent Spaces', async ({ page }) => {
    await openApp(page, 'light', { 'bava.recents': JSON.stringify(RECENTS) });
    await openSpace(page);
    const switcher = page.locator('.bava-space-switcher');
    await switcher.click();
    await expect(menus(page).getByRole('menuitem', { name: /Thesis/ })).toBeVisible();
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
  });

  for (const [what, path] of [
    ['page', 'Roadmap.md'],
    ['folder', 'Marketing'],
  ] as const) {
    test(`the right-click menu on a ${what}`, async ({ page }) => {
      await openApp(page, 'light');
      await openSpace(page);
      const row = page.locator(`[data-path="${path}"]`);
      await rightClick(page, row);
      await expect(menus(page)).toHaveCount(1);
      await expect(menus(page).getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      // The row the menu is for stays marked while it is open.
      await expect(row).toHaveAttribute('data-menu', '');
    });
  }

  test('a folder opens and folds on a click', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    const folder = page.locator('[data-path="Engineering"]');
    const inside = page.locator('[data-path="Engineering/Architecture.md"]');
    await folder.click();
    await expect(inside).toBeVisible();
    await folder.click();
    await expect(inside).toBeHidden();
  });
});
