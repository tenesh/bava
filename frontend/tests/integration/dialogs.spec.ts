import { expect, test } from '@playwright/test';
import { imagesLoaded, openApp, openDialog, openSpace } from '../helpers';

// Escape while renaming once closed the whole Media dialog: it leaves the
// rename, keeps the dialog, and gives the keyboard back to Rename.
test('Escape while renaming in Media leaves the rename, not the dialog', async ({ page }) => {
  await openApp(page, 'light');
  await openSpace(page);
  await page.getByRole('button', { name: 'Open Media' }).click();
  const dialog = openDialog(page);
  await imagesLoaded(dialog);
  await dialog.locator('[data-name="logo.png"]').click();
  await dialog.getByRole('button', { name: 'Rename' }).click();
  const field = dialog.locator('.media-rename');
  await expect(field).toBeFocused();
  await field.fill('brand');
  await field.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(field).toHaveCount(0);
  await expect(dialog.locator('.detail-name')).toHaveText('logo.png');
  await expect(dialog.getByRole('button', { name: 'Rename' })).toBeFocused();
  // A second Escape, with no rename open, closes the dialog as before.
  await page.keyboard.press('Escape');
  await expect(openDialog(page)).toHaveCount(0);
});
