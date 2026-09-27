import { expect, test } from '@playwright/test';
import { THEMES, menu, openApp, openDialog, shot } from './helpers';

for (const theme of THEMES) {
  test.describe(`Settings, ${theme}`, () => {
    for (const section of ['Appearance', 'Files', 'Canvas', 'Advanced']) {
      test(section, async ({ page }) => {
        await openApp(page, theme);
        await menu(page, 'app.settings');
        await expect(openDialog(page)).toBeVisible();
        await page.getByRole('tab', { name: section }).click();
        await expect(openDialog(page)).toHaveScreenshot(shot('settings', 'settings', section.toLowerCase(), theme));
      });
    }
  });
}
