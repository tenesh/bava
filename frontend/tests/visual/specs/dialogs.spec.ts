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

    test('the Media dialog', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.getByRole('button', { name: 'Open Media' }).click();
      const dialog = openDialog(page);
      await expect(dialog.locator('.media-item')).toHaveCount(9);
      // Which pages use each file is read from the pages: Unused follows.
      await expect(dialog.locator('.media-item').filter({ hasText: 'Unused' })).toHaveCount(2);
      await expect(dialog.locator('.media-item img').first()).toHaveJSProperty('complete', true);
      await dialogShot(page, 'media', 'grid', theme);
      await dialog.locator('[data-name="logo.png"]').click();
      await expect(dialog.locator('.media-used-by button')).toHaveText(['Media']);
      await dialogShot(page, 'media', 'chosen', theme);
      await dialog.getByText('List', { exact: true }).click();
      await dialog.getByText('Unused', { exact: true }).click();
      await expect(dialog.locator('.media-item')).toHaveCount(2);
      await dialogShot(page, 'media', 'unused-list', theme);
    });

    test('deleting a file pages use asks first', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.getByRole('button', { name: 'Open Media' }).click();
      await expect(openDialog(page).locator('.media-item').filter({ hasText: 'Unused' })).toHaveCount(2);
      await openDialog(page).locator('[data-name="logo.png"]').click();
      await openDialog(page).getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page.getByText('Delete “logo.png”?')).toBeVisible();
      await expect(page).toHaveScreenshot(shot('dialogs', 'media', 'confirm-delete', theme));
    });

    test('unused files moved to the Trash, and listed there', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.getByRole('button', { name: 'Open Media' }).click();
      await expect(openDialog(page).locator('.media-item').filter({ hasText: 'Unused' })).toHaveCount(2);
      await page.getByRole('button', { name: 'Move unused to Trash' }).click();
      await expect(page.getByText('Move 2 unused files to the Trash?')).toBeVisible();
      await page.getByRole('button', { name: 'Move unused to Trash' }).last().click();
      await expect(openDialog(page).locator('.media-item')).toHaveCount(7);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Media' })).toBeHidden();
      await menu(page, 'space.trash');
      await expect(openDialog(page).locator('li.item')).toHaveCount(4);
      await dialogShot(page, 'trash', 'with-attachments', theme);
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
      await expect(openDialog(page)).toBeVisible();
      // The dialog opens with the code in focus: pictured once it is there.
      await expect(openDialog(page).locator('.cm-content')).toBeFocused();
      // The editor follows the theme: its gutter and current line are no
      // lighter than the page in dark, no darker in light.
      const shades = await page.evaluate(() => {
        const lum = (el: Element | null) => {
          const [r, g, b] = (getComputedStyle(el!).backgroundColor.match(/[\d.]+/g) ?? ['0', '0', '0']).map(Number);
          const alpha = Number(getComputedStyle(el!).backgroundColor.match(/[\d.]+/g)?.[3] ?? 1);
          return { lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, alpha };
        };
        const parts = ['.cm-gutters', '.cm-activeLine', '.cm-activeLineGutter'];
        return parts
          .map((part) => document.querySelector(`.bava-dialog-content ${part}`))
          .filter((el): el is Element => el !== null)
          .map((el) => ({ part: el.className, ...lum(el) }));
      });
      expect(shades.length).toBeGreaterThan(0);
      for (const shade of shades) {
        if (shade.alpha > 0.5) expect(theme === 'dark' ? shade.lum < 0.35 : shade.lum > 0.65).toBe(true);
      }
      await dialogShot(page, 'diagram', 'empty', theme);
    });
  });
}
