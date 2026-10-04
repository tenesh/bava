import { expect, test } from '@playwright/test';
import { caretOnWord, fault, imagesLoaded, menu, openApp, openDialog, openDocument, openPage, openSpace, restPointer, sidePane, statusMessage } from '../helpers';

/** Autosave a moment after typing stops, as a person may have set it. */
const AUTOSAVE = { settings: { autosave: 'afterDelay', autosaveDelayMs: 200 } };

// The window's behaviour: the split between Files and Media dragged, and the
// status bar's notice for each thing that can go wrong.

test.describe('the window', () => {
  test('the split between Files and Media, dragged and let go', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await imagesLoaded(sidePane(page));
    const handle = sidePane(page).locator('.bava-splitter-handle');
    const media = sidePane(page).locator('.bava-splitter-panel').last();
    const before = (await media.boundingBox())!.height;
    const box = (await handle.boundingBox())!;
    // The line is one pixel high, and the pointer finds it a few pixels
    // either side: the press is two pixels below it. The drag moves by the
    // same 120 pixels, so it ends where a press on the line would.
    const press = box.y + 2;
    await page.mouse.move(box.x + box.width / 2, press);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, press - 120, { steps: 6 });
    await expect(handle).toHaveAttribute('data-dragging', '');
    await expect.poll(async () => (await media.boundingBox())!.height).toBeGreaterThan(before + 100);
    await page.mouse.up();
    await expect(handle).not.toHaveAttribute('data-dragging', '');
    await restPointer(page);
    await imagesLoaded(sidePane(page));
  });

  test('autosave paused: the file changed on disk', async ({ page }) => {
    await openApp(page, 'light', {}, AUTOSAVE);
    await openPage(page, 'Marketing/Launch plan.md');
    await fault(page, 'changedOnDisk', true);
    await caretOnWord(page, 'thousand');
    await page.keyboard.type('s');
    await expect(statusMessage(page)).toHaveText('Autosave paused: file changed on disk. Save to decide.');
    await expect(page.locator('header .state')).toHaveText('unsaved');
  });

  test('autosave paused: the last save failed', async ({ page }) => {
    await openApp(page, 'light', {}, AUTOSAVE);
    await openPage(page, 'Marketing/Launch plan.md');
    await fault(page, 'saveFails', true);
    await caretOnWord(page, 'thousand');
    await page.keyboard.type('s');
    await expect(statusMessage(page)).toHaveText('Autosave paused: the last save failed. Save to retry.');
  });

  test('the settings could not be read', async ({ page }) => {
    await openApp(page, 'light', {}, { failSettings: true });
    await expect(statusMessage(page)).toHaveText('Settings could not be read; changes will not be saved.');
  });

  test('a setting could not be saved', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await fault(page, 'settingsSaveFails', true);
    await menu(page, 'app.settings');
    await page.getByRole('tab', { name: 'Canvas' }).click();
    await openDialog(page).getByRole('radiogroup').last().getByText('On', { exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(openDialog(page)).toHaveCount(0);
    await expect(statusMessage(page)).toHaveText('That setting could not be saved.');
  });

  test('a name Go refuses', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Marketing/Launch plan.md');
    await menu(page, 'file.new');
    const field = page.locator('input.rename').filter({ visible: true });
    await expect(field).toBeFocused();
    await field.fill('Brand guide');
    await field.press('Enter');
    await expect(statusMessage(page)).toHaveText('Something with that name is already there.');
  });
});
