import { expect, test } from '@playwright/test';
import { THEMES, menu, openApp, openDialog, restPointer, shot, shotDialog } from './helpers';

for (const theme of THEMES) {
  test.describe(`Settings, ${theme}`, () => {
    for (const section of ['Appearance', 'Files', 'Canvas', 'Advanced']) {
      test(section, async ({ page }) => {
        await openApp(page, theme);
        await menu(page, 'app.settings');
        await expect(openDialog(page)).toBeVisible();
        await page.getByRole('tab', { name: section }).click();
        await restPointer(page);
        await expect(page.getByRole('tab', { name: section })).toHaveAttribute('aria-selected', 'true');
        await shotDialog(page, shot('settings', 'tab', section.toLowerCase(), theme));
      });
    }
  });

  test.describe(`Settings changed from the defaults, ${theme}`, () => {
    test('Appearance: following the system, pages narrow', async ({ page }) => {
      // The system is in the same theme, so following it keeps the picture's.
      await page.emulateMedia({ colorScheme: theme });
      await openApp(page, theme);
      await menu(page, 'app.settings');
      const dialog = openDialog(page);
      await dialog.getByText('Follow system', { exact: true }).click();
      await dialog.getByText('Narrow', { exact: true }).click();
      await expect(dialog.getByRole('radio', { name: 'Follow system' })).toBeChecked();
      await expect(dialog.getByRole('radio', { name: 'Narrow' })).toBeChecked();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await restPointer(page);
      await shotDialog(page, shot('settings', 'appearance', 'changed', theme));
    });

    test('Files: autosave after a delay, and a delay out of range', async ({ page }) => {
      await openApp(page, theme);
      await menu(page, 'app.settings');
      await page.getByRole('tab', { name: 'Files' }).click();
      const dialog = openDialog(page);
      await dialog.getByText('After a delay', { exact: true }).click();
      const delay = dialog.getByRole('spinbutton', { name: 'Delay (ms)' });
      await delay.fill('2500');
      // Taken when the field is left.
      await delay.blur();
      await expect(dialog.getByRole('radio', { name: 'After a delay' })).toBeChecked();
      await expect(delay).toHaveValue('2500');
      await restPointer(page);
      await shotDialog(page, shot('settings', 'files', 'after-delay', theme));
      // Below the shortest delay: it is held at the shortest.
      await delay.fill('50');
      await delay.blur();
      await expect(delay).toHaveValue('200');
      await restPointer(page);
      await shotDialog(page, shot('settings', 'files', 'delay-held', theme));
    });

    test('Files: autosave when focus leaves', async ({ page }) => {
      await openApp(page, theme);
      await menu(page, 'app.settings');
      await page.getByRole('tab', { name: 'Files' }).click();
      const dialog = openDialog(page);
      await dialog.getByText('When focus leaves', { exact: true }).click();
      await expect(dialog.getByRole('radio', { name: 'When focus leaves' })).toBeChecked();
      // No delay to set in this mode.
      await expect(dialog.getByRole('spinbutton')).toHaveCount(0);
      await restPointer(page);
      await shotDialog(page, shot('settings', 'files', 'on-focus-change', theme));
    });

    test('Canvas: every setting turned the other way', async ({ page }) => {
      await openApp(page, theme);
      await menu(page, 'app.settings');
      await page.getByRole('tab', { name: 'Canvas' }).click();
      const dialog = openDialog(page);
      const groups = dialog.getByRole('radiogroup');
      await expect(groups).toHaveCount(3);
      // Arrow binding and midpoint snap start on, object snap off.
      await groups.nth(0).getByText('Off', { exact: true }).click();
      await groups.nth(1).getByText('Off', { exact: true }).click();
      await groups.nth(2).getByText('On', { exact: true }).click();
      await expect(groups.nth(0).getByRole('radio', { name: 'Off' })).toBeChecked();
      await expect(groups.nth(1).getByRole('radio', { name: 'Off' })).toBeChecked();
      await expect(groups.nth(2).getByRole('radio', { name: 'On' })).toBeChecked();
      await restPointer(page);
      await shotDialog(page, shot('settings', 'canvas', 'changed', theme));
    });

    test('Advanced: verbose logging on', async ({ page }) => {
      await openApp(page, theme);
      await menu(page, 'app.settings');
      await page.getByRole('tab', { name: 'Advanced' }).click();
      const dialog = openDialog(page);
      await dialog.getByRole('radiogroup').getByText('On', { exact: true }).click();
      await expect(dialog.getByRole('radiogroup').getByRole('radio', { name: 'On' })).toBeChecked();
      await restPointer(page);
      await shotDialog(page, shot('settings', 'advanced', 'changed', theme));
    });
  });
}
