import { expect, test, type Page } from '@playwright/test';
import { THEMES, emit, menu, openApp, openDialog, openPage, openSpace, shot } from './helpers';

async function dialogShot(page: Page, name: string, state: string, theme: 'light' | 'dark') {
  await expect(openDialog(page)).toBeVisible();
  await expect(openDialog(page)).toHaveScreenshot(shot('dialogs', name, state, theme));
}

for (const theme of THEMES) {
  test.describe(`dialogs, ${theme}`, () => {
    test('New Space', async ({ page }) => {
      await openApp(page, theme);
      await page.getByRole('button', { name: 'New Space' }).click();
      await dialogShot(page, 'new-space', 'empty', theme);
    });

    test('Space settings', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'file.spaceSettings');
      // It opens on the name, not on its close button.
      await expect(page.locator('#space-name')).toBeFocused();
      await dialogShot(page, 'space-settings', 'default', theme);
    });

    test('the Trash, with items', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'space.trash');
      await expect(openDialog(page).locator('li.item')).toHaveCount(2);
      // It opens on the search field, never on Empty Trash.
      await expect(openDialog(page).locator('input[type="search"]')).toBeFocused();
      await dialogShot(page, 'trash', 'with-items', theme);
    });

    test('the Trash, empty', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.evaluate(() => {
        const fakes = (window as unknown as { __bava: { fakes: { SpaceService: { Apply(root: string, op: object): Promise<unknown> } } } }).__bava.fakes;
        return fakes.SpaceService.Apply('/Users/you/Documents/Acme Product', { kind: 'emptyTrash', path: '', folder: '', name: '', index: -1, id: '', width: '' });
      });
      await menu(page, 'space.trash');
      await dialogShot(page, 'trash', 'empty', theme);
    });

    test('confirming a delete from the Trash', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'space.trash');
      await openDialog(page).locator('li.item').first().hover();
      await page.getByRole('button', { name: /^Delete Q3 retro$/ }).click();
      const confirm = openDialog(page).filter({ hasText: 'for good?' });
      await expect(confirm).toBeVisible();
      await expect(confirm).toHaveScreenshot(shot('dialogs', 'confirm', 'delete-forever', theme));
    });

    test('Keyboard shortcuts', async ({ page }) => {
      await openApp(page, theme);
      await menu(page, 'help.shortcuts');
      await dialogShot(page, 'shortcuts', 'default', theme);
    });

    test('About', async ({ page }) => {
      await openApp(page, theme);
      await menu(page, 'help.about');
      await dialogShot(page, 'about', 'default', theme);
    });

    test('an unexpected error', async ({ page }) => {
      await openApp(page, theme);
      await emit(page, 'app:error', { id: 'e-7f3a91', kind: 'panic' });
      await dialogShot(page, 'error', 'with-details', theme);
    });

    test('Export', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Engineering', 'Engineering/Architecture.md');
      await menu(page, 'file.export');
      await expect(openDialog(page)).toBeVisible();
      // The preview fits its frame whole: nothing cut off at an edge.
      const fits = await page.evaluate(() => {
        const frame = document.querySelector('.preview-frame')!.getBoundingClientRect();
        const svg = document.querySelector('.bava-export-preview svg')!.getBoundingClientRect();
        return svg.top >= frame.top - 0.5 && svg.bottom <= frame.bottom + 0.5 && svg.left >= frame.left - 0.5 && svg.right <= frame.right + 0.5;
      });
      expect(fits).toBe(true);
      await dialogShot(page, 'export', 'canvas', theme);
    });

    test('Diagram from Code', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Engineering', 'Engineering/Architecture.md');
      await menu(page, 'insert.diagram');
      await dialogShot(page, 'diagram', 'empty', theme);
    });
  });
}
