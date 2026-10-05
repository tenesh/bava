import { expect, test } from '@playwright/test';
import { THEMES, openApp, restPointer, shot, shotDialog } from '../helpers';

const RECENTS = [
  { path: '/Users/you/Documents/Acme Product', kind: 'space', openedAt: Date.UTC(2026, 8, 26) },
  { path: '/Users/you/Documents/Thesis', kind: 'space', openedAt: Date.UTC(2026, 8, 20) },
];

for (const theme of THEMES) {
  test.describe(`the start screen, ${theme}`, () => {
    test('with no recent Spaces', async ({ page }) => {
      await openApp(page, theme);
      await restPointer(page);
      await expect(page.getByRole('button', { name: 'New Space' })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('start', 'screen', 'no-recents', theme));
    });

    test('with recent Spaces', async ({ page }) => {
      await openApp(page, theme, { 'bava.recents': JSON.stringify(RECENTS) });
      await restPointer(page);
      await expect(page.getByText('Thesis').first()).toBeVisible();
      await expect(page).toHaveScreenshot(shot('start', 'screen', 'recents', theme));
    });

    // Reopening the last Space at launch finds its folder gone: its row
    // says so, with its remove button always showing.
    test('with a recent Space whose folder is gone', async ({ page }) => {
      await openApp(page, theme, { 'bava.recents': JSON.stringify(RECENTS), 'bava.lastSpace': RECENTS[1].path });
      await expect(page.getByText('Folder not found')).toBeVisible();
      await restPointer(page);
      await expect(page).toHaveScreenshot(shot('start', 'screen', 'missing', theme));
    });

    test('removing a Space, asked first', async ({ page }) => {
      await openApp(page, theme, { 'bava.recents': JSON.stringify(RECENTS) });
      await page.locator('.recent', { hasText: 'Acme Product' }).hover();
      await page.getByRole('button', { name: 'Remove Acme Product from list' }).click();
      await restPointer(page);
      await shotDialog(page, shot('start', 'remove', 'asked', theme));
    });
  });
}
