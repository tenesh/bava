import { expect, test } from '@playwright/test';
import { menu, openApp, openDialog, savedSettings } from '../helpers';

// Settings as a person changes them: each control's new state, and what it saves.

test.describe('settings changed', () => {
  test('Appearance: following the system, pages narrow', async ({ page }) => {
    // The system is light, so following it keeps the page light.
    await page.emulateMedia({ colorScheme: 'light' });
    await openApp(page, 'light');
    await menu(page, 'app.settings');
    const dialog = openDialog(page);
    await dialog.getByText('Follow system', { exact: true }).click();
    await dialog.getByText('Narrow', { exact: true }).click();
    await expect(dialog.getByRole('radio', { name: 'Follow system' })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: 'Narrow' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('Files: autosave after a delay, and a delay out of range', async ({ page }) => {
    await openApp(page, 'light');
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
    await expect.poll(() => savedSettings(page)).toMatchObject({ autosave: 'afterDelay', autosaveDelayMs: 2500 });
    // Below the shortest delay: it is held at the shortest.
    await delay.fill('50');
    await delay.blur();
    await expect(delay).toHaveValue('200');
    await expect.poll(() => savedSettings(page)).toMatchObject({ autosaveDelayMs: 200 });
  });

  test('Files: autosave when focus leaves', async ({ page }) => {
    await openApp(page, 'light');
    await menu(page, 'app.settings');
    await page.getByRole('tab', { name: 'Files' }).click();
    const dialog = openDialog(page);
    await dialog.getByText('When focus leaves', { exact: true }).click();
    await expect(dialog.getByRole('radio', { name: 'When focus leaves' })).toBeChecked();
    // No delay to set in this mode.
    await expect(dialog.getByRole('spinbutton')).toHaveCount(0);
    await expect.poll(() => savedSettings(page)).toMatchObject({ autosave: 'onFocusChange' });
  });

  test('Canvas: every setting turned the other way', async ({ page }) => {
    await openApp(page, 'light');
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
    await expect.poll(() => savedSettings(page)).toMatchObject({ arrowBinding: false, midpointSnap: false, objectSnap: true });
  });

  test('Advanced: verbose logging on', async ({ page }) => {
    await openApp(page, 'light');
    await menu(page, 'app.settings');
    await page.getByRole('tab', { name: 'Advanced' }).click();
    const dialog = openDialog(page);
    await dialog.getByRole('radiogroup').getByText('On', { exact: true }).click();
    await expect(dialog.getByRole('radiogroup').getByRole('radio', { name: 'On' })).toBeChecked();
    await expect.poll(() => savedSettings(page)).toMatchObject({ verboseLogging: true });
  });
});
