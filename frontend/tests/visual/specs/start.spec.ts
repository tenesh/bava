import { expect, test } from '@playwright/test';
import { THEMES, expectNothingCovering, openApp, shot } from './helpers';

for (const theme of THEMES) {
  test.describe(`launch, ${theme}`, () => {
    // Closed dialogs once covered the window at launch with every logic test
    // green: nothing may show until something is opened.
    test('covers nothing', async ({ page }) => {
      await openApp(page, theme);
      await expectNothingCovering(page);
    });

    test('the start screen', async ({ page }) => {
      await openApp(page, theme);
      await expect(page).toHaveScreenshot(shot('start', 'start', 'no-recents', theme));
    });

    test('the start screen with recent Spaces', async ({ page }) => {
      const recents = [
        { path: '/Users/you/Documents/Acme Product', kind: 'space', openedAt: Date.UTC(2026, 8, 26) },
        { path: '/Users/you/Documents/Thesis', kind: 'space', openedAt: Date.UTC(2026, 8, 20) },
      ];
      await openApp(page, theme, { 'bava.recents': JSON.stringify(recents) });
      await expect(page).toHaveScreenshot(shot('start', 'start', 'recents', theme));
    });
  });
}
