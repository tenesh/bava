import { expect, test, type Page } from '@playwright/test';
import { SPACE, editor, expectNothingCovering, menu, newLineAtEnd, openApp, openDialog, openPage, openSpace } from '../helpers';

// Closed dialogs once covered the window at launch with every logic test
// green: nothing may show until something is opened.
test('nothing covers the window at launch', async ({ page }) => {
  await openApp(page, 'light');
  await expectNothingCovering(page);
});

const THESIS = '/Users/you/Documents/Thesis';
const RECENTS = [
  { path: SPACE, kind: 'space', openedAt: Date.UTC(2026, 8, 26) },
  { path: THESIS, kind: 'space', openedAt: Date.UTC(2026, 8, 20) },
];
const recentNames = (page: Page) => page.locator('.recents .name');
// What the window keeps for the next launch (the harness seeds it again on a reload).
const kept = (page: Page, key: string) => page.evaluate((name) => localStorage.getItem(name), key);
type AttachmentsHarness = { __bava: { fakes: { SpaceService: { Attachments(root: string): Promise<{ attachments: unknown[] }> } } } };
const attachments = async (page: Page) =>
  (await page.evaluate((root) => (window as unknown as AttachmentsHarness).__bava.fakes.SpaceService.Attachments(root), SPACE)).attachments;
const removeButton = (page: Page, name: string) => page.getByRole('button', { name: `Remove ${name} from list` });

test.describe('removing a Space from the list', () => {
  test('from the start screen, asked first, and forgotten for the next launch', async ({ page }) => {
    await openApp(page, 'light', { 'bava.recents': JSON.stringify(RECENTS) });
    await page.locator('.recent', { hasText: 'Thesis' }).hover();
    await removeButton(page, 'Thesis').click();
    const dialog = openDialog(page);
    await expect(dialog).toContainText('Remove Thesis from the list?');
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await expect(recentNames(page)).toHaveText(['Acme Product']);
    expect(await kept(page, 'bava.recents')).not.toContain('Thesis');
  });

  test('from the start screen by keys: Tab reaches the remove button after its row, Cancel keeps the Space', async ({ page }) => {
    await openApp(page, 'light', { 'bava.recents': JSON.stringify(RECENTS) });
    await page.locator('.recent', { hasText: 'Acme Product' }).focus();
    await page.keyboard.press('Tab');
    await expect(removeButton(page, 'Acme Product')).toBeFocused();
    await expect(removeButton(page, 'Acme Product')).toHaveCSS('opacity', '1');
    await page.keyboard.press('Enter');
    await openDialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(recentNames(page)).toHaveText(['Acme Product', 'Thesis']);
  });

  test('the open Space from the switcher, its data kept with the switch left off', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    const before = await attachments(page);
    expect(before.length).toBeGreaterThan(0);
    await page.locator('.bava-space-switcher').click();
    await page.getByRole('menuitem', { name: 'Remove from List' }).click();
    await openDialog(page).getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('button', { name: 'New Space' })).toBeVisible();
    expect(await attachments(page)).toEqual(before);
  });

  test('the open Space from the switcher, its data deleted when asked, and not reopened at launch', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    expect((await attachments(page)).length).toBeGreaterThan(0);
    await page.locator('.bava-space-switcher').click();
    await page.getByRole('menuitem', { name: 'Remove from List' }).click();
    const dialog = openDialog(page);
    await dialog.getByText("Also delete Bava's data in this folder").click();
    await expect(dialog.getByRole('checkbox')).toBeChecked();
    await dialog.getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('button', { name: 'New Space' })).toBeVisible();
    await expect(recentNames(page)).toHaveCount(0);
    expect(await attachments(page)).toEqual([]);
    expect(await kept(page, 'bava.lastSpace')).toBeNull();
  });

  test('an unsaved page is asked about first, and Cancel keeps the Space open', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Roadmap.md');
    await menu(page, 'view.document');
    await newLineAtEnd(page);
    await page.keyboard.type('Not saved yet');
    await expect(editor(page)).toContainText('Not saved yet');
    await page.locator('.bava-space-switcher').click();
    await page.getByRole('menuitem', { name: 'Remove from List' }).click();
    await openDialog(page).getByRole('button', { name: 'Remove' }).click();
    const unsaved = openDialog(page);
    await expect(unsaved).toContainText('unsaved', { ignoreCase: true });
    await unsaved.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-path="Roadmap.md"]')).toBeVisible();
    await expect(page.locator('.bava-space-switcher')).toContainText('Acme Product');
  });
});
