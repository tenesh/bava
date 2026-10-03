import { expect, test } from '@playwright/test';
import { THEMES, openApp, restPointer, shot } from './helpers';

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
  });
}
