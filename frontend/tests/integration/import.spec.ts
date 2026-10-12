import { expect, test, type Page } from '@playwright/test';
import { PARENT, SPACE, menu, menus, openApp, openSpace, rightClick, sidePane, statusMessage } from '../helpers';

// Import, from each way in: File ▸ Import ▸ Folder and ▸ Files, and a
// folder's right-click. The stand-in's disk holds a "Q4 notes" folder: two
// pages, a picture, and a hidden .git that stays behind.

type Harness = { faults: object; importFiles: string[] };
const harness = (page: Page, change: Partial<Harness> & { faults?: object }) =>
  page.evaluate((c) => {
    const h = (window as unknown as { __bava: { fakes: { harness: Harness } } }).__bava.fakes.harness;
    if (c.faults) Object.assign(h.faults, c.faults);
    if (c.importFiles) h.importFiles = c.importFiles;
  }, change);
const textOf = (page: Page, path: string) =>
  page.evaluate(
    async ({ root, path }) =>
      (await (window as unknown as { __bava: { fakes: { SpaceService: { Index(r: string, t: boolean): Promise<{ pages: { path: string; text: string }[] }> } } } }).__bava.fakes.SpaceService.Index(root, true)).pages.find((p) => p.path === path)?.text,
    { root: SPACE, path },
  );
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Import' });

test.describe('import', () => {
  test('File ▸ Import ▸ Folder brings the folder in whole, its picture pointed at the attachments', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'file.importFolder');
    await expect(dialog(page)).toContainText('From Q4 notes');
    await expect(dialog(page)).toContainText('Goals');
    await expect(dialog(page)).toContainText('2 pages · 1 file');
    await expect(dialog(page)).not.toContainText('Renamed to keep both');
    await dialog(page).getByRole('button', { name: 'Import' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(statusMessage(page)).toContainText('Imported into Acme Product.');
    await expect(sidePane(page).locator('[data-path="Q4 notes"]')).toBeVisible();
    await expect.poll(() => textOf(page, 'Q4 notes/Goals.md')).toContain('![chart](../.bava/attachments/chart.png)');
    // A link between the imported pages still reaches its page, so it stays as written.
    await expect.poll(() => textOf(page, 'Q4 notes/Press/Media kit.md')).toContain('[the goals](../Goals.md)');
  });

  test('importing the same folder again keeps both, numbering the new one', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'file.importFolder');
    await dialog(page).getByRole('button', { name: 'Import' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await menu(page, 'file.importFolder');
    await expect(dialog(page)).toContainText('Renamed to keep both');
    await expect(dialog(page)).toContainText('Q4 notes 2');
    await dialog(page).getByRole('button', { name: 'Import' }).click();
    await expect(sidePane(page).locator('[data-path="Q4 notes 2"]')).toBeVisible();
    await expect.poll(() => textOf(page, 'Q4 notes 2/Goals.md')).toContain('# Goals');
  });

  test("a folder's right-click imports into that folder", async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await rightClick(page, sidePane(page).locator('[data-path="Marketing"]'));
    await menus(page).getByRole('menuitem', { name: 'Import', exact: true }).click();
    await menus(page).getByRole('menuitem', { name: 'Folder', exact: true }).click();
    await expect(dialog(page).getByRole('combobox', { name: 'Into' })).toContainText('Marketing');
    await dialog(page).getByRole('button', { name: 'Import' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(statusMessage(page)).toContainText('Imported into Marketing.');
    await expect.poll(() => textOf(page, 'Marketing/Q4 notes/Goals.md')).toContain('# Goals');
  });

  test('choosing Into shows the import planned there', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'file.importFolder');
    const into = dialog(page).getByRole('combobox', { name: 'Into' });
    // Into waits for the plan, as Import does.
    await expect(into).toBeEnabled();
    await into.focus();
    await page.keyboard.press('Enter');
    // Chosen by keys, as a list that floats can still be settling under a click.
    const list = page.locator('.bava-select-content').filter({ visible: true });
    await expect(list).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(list.locator('.bava-select-item[data-highlighted]')).toHaveText('Marketing');
    await page.keyboard.press('Enter');
    await expect(into).toContainText('Marketing');
    await dialog(page).getByRole('button', { name: 'Import' }).click();
    await expect.poll(() => textOf(page, 'Marketing/Q4 notes/Goals.md')).toContain('# Goals');
  });

  test('File ▸ Import ▸ Files brings pages straight into the folder', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await harness(page, { importFiles: [`${PARENT}/Q4 notes/Goals.md`] });
    await menu(page, 'file.importFiles');
    await expect(dialog(page)).toContainText('From Goals.md');
    await dialog(page).getByRole('button', { name: 'Import' }).click();
    await expect(sidePane(page).locator('[data-path="Goals.md"]')).toBeVisible();
  });

  test('Cancel while importing stops it and adds nothing', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await harness(page, { faults: { slowImport: 400 } });
    await menu(page, 'file.importFolder');
    await dialog(page).getByRole('button', { name: 'Import' }).click();
    await expect(dialog(page)).toContainText('Importing');
    await expect(dialog(page).getByRole('button', { name: 'Import' })).toBeDisabled();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(statusMessage(page)).toContainText('Import cancelled. Nothing was added.');
    await expect(sidePane(page).locator('[data-path="Q4 notes"]')).toHaveCount(0);
  });

  test('another import or export waits until this import is done', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await harness(page, { faults: { slowImport: 200 } });
    await menu(page, 'file.importFolder');
    await dialog(page).getByRole('button', { name: 'Import' }).click();
    await expect(dialog(page)).toContainText('Importing');
    await menu(page, 'file.importFolder');
    await menu(page, 'file.exportSpace');
    await expect(dialog(page)).toContainText('Importing');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(statusMessage(page)).toContainText('Imported into Acme Product.');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Import is not offered with no Space open', async ({ page }) => {
    await openApp(page, 'light');
    await menu(page, 'file.importFolder');
    await expect(dialog(page)).toHaveCount(0);
  });
});
