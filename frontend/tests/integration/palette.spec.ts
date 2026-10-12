import { expect, test, type Page } from '@playwright/test';
import { box } from '../fixtures/canvas-scenes';
import { clickScene, editor, menu, openApp, openPage, selectionToolbar, startCanvas } from '../helpers';

// The command palette: ⇧⌘P (a native accelerator, so the menu command here),
// every menu command by name, Enter runs it where focus was.

const palette = (page: Page) => page.getByRole('dialog', { name: 'Command Palette' });
const field = (page: Page) => palette(page).getByRole('searchbox', { name: 'Command Palette' });
const readout = (page: Page) => page.locator("[data-side='canvas'] .readout");

test.describe('the command palette', () => {
  test('opens on every command by menu, nothing recent yet', async ({ page }) => {
    await openApp(page, 'light');
    await menu(page, 'view.commandPalette');
    await expect(field(page)).toBeFocused();
    await expect(palette(page).locator('.group-title').first()).not.toHaveText('Recent');
    await expect(palette(page).locator('.group-title', { hasText: 'File' })).toHaveCount(1);
  });

  test('runs what is typed, then lists it as recent', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100), box('b2', 1400, 900)]);
    await expect(readout(page)).toHaveText('100%');
    await menu(page, 'view.commandPalette');
    await field(page).fill('zoom fit');
    await page.keyboard.press('Enter');
    await expect(palette(page)).toHaveCount(0);
    await expect(readout(page)).not.toHaveText('100%');
    await menu(page, 'view.commandPalette');
    await expect(palette(page).locator('.group-title').first()).toHaveText('Recent');
    await expect(palette(page).locator('[role="option"]').first()).toContainText('Zoom to Fit');
  });

  test('offers what can run now: Zoom to Selection only with something selected', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100)]);
    await menu(page, 'view.commandPalette');
    await field(page).fill('zoom selection');
    await expect(palette(page)).toContainText('No command matches');
    await page.keyboard.press('Escape');
    await clickScene(page, { x: 160, y: 140 });
    await menu(page, 'view.commandPalette');
    await field(page).fill('zoom selection');
    await expect(palette(page).locator('[role="option"]')).toContainText(['Zoom to Selection']);
  });

  test('runs where focus was: Undo undoes the typing in the page', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Roadmap.md');
    await editor(page).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' typed here');
    await expect(editor(page)).toContainText('typed here');
    await menu(page, 'view.commandPalette');
    await field(page).fill('undo');
    await page.keyboard.press('Enter');
    await expect(editor(page)).not.toContainText('typed here');
  });

  test('Escape closes it and gives the keyboard back to the page', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Roadmap.md');
    await editor(page).click();
    await menu(page, 'view.commandPalette');
    await page.keyboard.press('Escape');
    await expect(palette(page)).toHaveCount(0);
    await expect(editor(page)).toBeFocused();
  });

  test('waits while Search or a dialog is open, and Search takes over from it', async ({ page }) => {
    await openApp(page, 'light');
    await menu(page, 'file.openSpace');
    await menu(page, 'file.search');
    const search = page.getByRole('dialog', { name: 'Search' });
    await expect(search).toBeVisible();
    await menu(page, 'view.commandPalette');
    await expect(palette(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await menu(page, 'help.shortcuts');
    await menu(page, 'view.commandPalette');
    await expect(palette(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await menu(page, 'view.commandPalette');
    await expect(palette(page)).toBeVisible();
    await menu(page, 'file.search');
    await expect(palette(page)).toHaveCount(0);
    await expect(search).toBeVisible();
  });

  test('runs Select All on the canvas when the canvas had the keys', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100), box('b2', 300, 100)]);
    // Empty canvas: the canvas has the keys, and nothing is selected.
    await clickScene(page, { x: 900, y: 560 });
    await expect(selectionToolbar(page)).toHaveCount(0);
    await menu(page, 'view.commandPalette');
    await field(page).fill('select all');
    await page.keyboard.press('Enter');
    await expect(selectionToolbar(page)).toBeVisible();
  });
});
