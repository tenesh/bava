import { expect, test } from '@playwright/test';
import {
  anotherSpace,
  caretOnWord,
  fault,
  imagesLoaded,
  menu,
  newSpaceFromSwitcher,
  openApp,
  openDialog,
  openExport,
  openPage,
  openSpace,
  PARENT,
  statusMessage,
} from '../helpers';

/** The log file of a session that ended unexpectedly, as Go names it. */
const LAST_SESSION = '2026-09-26T18-42-07-4182.log';

// The Media dialog's Type and Sort are dropdowns: by keys, by pointer, and
// Escape closing one without closing the dialog.
test('Media\'s Type and Sort dropdowns, by keys and by pointer', async ({ page }) => {
  await openApp(page, 'light');
  await openSpace(page);
  await page.getByRole('button', { name: 'Open Media' }).click();
  const dialog = openDialog(page);
  const items = dialog.locator('.media-item');
  await expect(items).toHaveCount(9);
  const type = dialog.getByRole('combobox', { name: 'Type' });
  await type.focus();
  await page.keyboard.press('Enter');
  const list = page.locator('.bava-select-content').filter({ visible: true });
  await expect(list.getByRole('option')).toHaveText(['All types', 'Images', 'Videos', 'PDFs', 'Other', 'Unused']);
  // The list opens on the current choice, and the keys move from there.
  await expect(list.locator('.bava-select-item[data-highlighted]')).toHaveText('All types');
  await expect(list).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(list.locator('.bava-select-item[data-highlighted]')).toHaveText('Images');
  await page.keyboard.press('Enter');
  await expect(type).toContainText('Images');
  await expect(type).toBeFocused();
  await expect(items.filter({ hasText: '.mp4' })).toHaveCount(0);

  const sort = dialog.getByRole('combobox', { name: 'Sort by' });
  await sort.click();
  await list.getByRole('option', { name: 'Size' }).click();
  await expect(sort).toContainText('Sort: Size');

  await sort.click();
  await expect(list).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  await expect(sort).toBeFocused();
  await expect(dialog).toBeVisible();
});

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

// What each dialog says or does as it changes: a setting, a name refused,
// a confirmation; the look of each is in visual/dialogs.spec.ts.
test.describe('dialogs as they change', () => {
  test('a failure the page left unhandled', async ({ page }) => {
    await openApp(page, 'light');
    await page.evaluate(() => {
      void Promise.reject(new TypeError('nothing caught this'));
    });
    await expect(openDialog(page)).toContainText('Something went wrong');
    // Its kind, never its message: a message can quote the user's work.
    await expect(openDialog(page).locator('dd')).toHaveText(['TypeError']);
    await expect(openDialog(page)).not.toContainText('nothing caught this');
  });

  test('the last session closed unexpectedly, with its log', async ({ page }) => {
    await openApp(page, 'light', {}, { notices: [{ kind: 'unexpectedExit', session: LAST_SESSION }] });
    await expect(openDialog(page)).toContainText('Bava closed unexpectedly');
    await expect(openDialog(page).locator('dd')).toHaveText([LAST_SESSION]);
  });

  test('the window was reloaded', async ({ page }) => {
    await openApp(page, 'light', {}, { notices: [{ kind: 'webviewReloaded', session: '' }] });
    await expect(openDialog(page)).toContainText('The window was reloaded');
    // The body says what happened: no details box, and nothing to copy.
    await expect(openDialog(page).locator('dd')).toHaveCount(0);
    await expect(openDialog(page).getByRole('button', { name: 'Copy details' })).toHaveCount(0);
  });

  test('New Space, named and placed', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await newSpaceFromSwitcher(page);
    const dialog = openDialog(page);
    await expect(dialog).toContainText(PARENT);
    await dialog.getByRole('textbox').fill('Thesis');
    await expect(dialog.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  test('New Space with a name no folder can have', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await newSpaceFromSwitcher(page);
    await openDialog(page).getByRole('textbox').fill('Q3/Q4');
    await openDialog(page).getByRole('button', { name: 'Create' }).click();
    await expect(openDialog(page).getByRole('alert')).toHaveText('A name cannot hold / or \\.');
    await expect(openDialog(page).getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  test('Space settings with the name emptied', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'file.spaceSettings');
    await page.locator('#space-name').fill('');
    await expect(openDialog(page).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('Space settings changed', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'file.spaceSettings');
    await page.locator('#space-name').fill('Acme Launch');
    await openDialog(page).getByText('Narrow', { exact: true }).click();
    await expect(openDialog(page).getByRole('radio', { name: 'Narrow' })).toBeChecked();
    await page.locator('#space-name').focus();
  });

  test('Space settings with a name another Space has', async ({ page }) => {
    await openApp(page, 'light');
    await anotherSpace(page, 'Thesis');
    await openSpace(page);
    await menu(page, 'file.spaceSettings');
    await page.locator('#space-name').fill('Thesis');
    await openDialog(page).getByRole('button', { name: 'Save' }).click();
    await expect(openDialog(page)).toHaveCount(0);
    await expect(statusMessage(page)).toHaveText('Something with that name is already there.');
    await expect(page.locator('.bava-space-switcher')).toContainText('Acme Product');
  });

  // 2× is where it starts, as `export--canvas` has it.
  for (const scale of ['1', '3']) {
    test(`Export at ${scale}×`, async ({ page }) => {
      const dialog = await openExport(page, 'light');
      await dialog.getByText(`${scale}×`, { exact: true }).click();
      await expect(dialog.getByRole('radio', { name: `${scale}×` })).toBeChecked();
    });
  }

  test('leaving a page with changes not saved', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Marketing/Launch plan.md');
    await caretOnWord(page, 'thousand');
    await page.keyboard.type('s');
    await expect(page.locator('header .state')).toHaveText('unsaved');
    await page.locator('[data-path="Roadmap.md"]').click();
    await expect(openDialog(page)).toContainText('Unsaved changes');
  });

  test('saving over a file another program changed', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Marketing/Launch plan.md');
    await caretOnWord(page, 'thousand');
    await page.keyboard.type('s');
    await fault(page, 'changedOnDisk', true);
    await menu(page, 'file.save');
    await expect(openDialog(page)).toContainText('This file changed on disk');
  });

  test('the Trash searched, and nothing matching', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'space.trash');
    const search = openDialog(page).locator('input[type="search"]');
    await search.fill('retro');
    await expect(openDialog(page).locator('li.item')).toHaveCount(1);
    await search.fill('zzz');
    await expect(openDialog(page).getByText('Nothing matches.')).toBeVisible();
  });

  test('confirming Empty Trash', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'space.trash');
    await openDialog(page).getByRole('button', { name: 'Empty Trash' }).click();
    const confirm = openDialog(page).filter({ hasText: 'Empty the Trash?' });
    await expect(confirm).toBeVisible();
  });
});
