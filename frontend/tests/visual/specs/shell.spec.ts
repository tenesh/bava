import { expect, test } from '@playwright/test';
import {
  THEMES,
  caretOnWord,
  emit,
  fault,
  imagesLoaded,
  menu,
  openApp,
  openAtLaunch,
  openDialog,
  openDocument,
  openLoosePage,
  openPage,
  openSpace,
  restPointer,
  shot,
  shotPane,
  sidePane,
  statusBar,
  statusMessage,
} from './helpers';

/** Autosave a moment after typing stops, as a person may have set it. */
const AUTOSAVE = { settings: { autosave: 'afterDelay', autosaveDelayMs: 200 } };

for (const theme of THEMES) {
  test.describe(`the main window, ${theme}`, () => {
    test('a Space open, a page in Both', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing/Launch plan.md');
      await restPointer(page);
      await imagesLoaded(sidePane(page));
      await expect(page.locator('[data-side="document"]')).toBeVisible();
      await expect(page.locator("[data-side='canvas']")).toBeVisible();
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'both', theme));
    });

    test('the Document view', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing/Launch plan.md');
      await menu(page, 'view.document');
      await restPointer(page);
      await imagesLoaded(sidePane(page));
      await expect(page.locator("[data-side='canvas']")).toBeHidden();
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'document', theme));
    });

    test('the Canvas view, with shapes on the dot grid', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Engineering/Architecture.md');
      await menu(page, 'view.canvas');
      await restPointer(page);
      await imagesLoaded(sidePane(page));
      // Nodes counts what is on the canvas: three shapes and an arrow.
      await expect(page.locator('footer')).toContainText('Nodes 4');
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'canvas', theme));
    });

    test('no page open in a Space', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await restPointer(page);
      await imagesLoaded(sidePane(page));
      await expect(page.getByText('Pick a page in Files, or make a new one.')).toBeVisible();
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'no-page', theme));
    });

    test('the Files pane hidden and the AI pane shown', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing/Launch plan.md');
      await menu(page, 'view.files');
      await menu(page, 'view.ai');
      await restPointer(page);
      await expect(sidePane(page)).toHaveCount(0);
      await expect(page.locator('.region-ai')).toBeVisible();
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'ai-no-files', theme));
    });

    test('a page opened on its own, in no Space', async ({ page }) => {
      await openApp(page, theme);
      await openLoosePage(page);
      await restPointer(page);
      await expect(sidePane(page).getByRole('button', { name: 'Open folder as Space' })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'loose-page', theme));
    });

    test('the splash at launch', async ({ page }) => {
      await openAtLaunch(page, theme);
      await expect(page.locator('[data-part="splash"] .status')).toHaveText('Starting');
      // Nothing behind it takes focus or a click while it covers the window.
      await expect(page.locator('.app')).toHaveAttribute('inert', '');
      await expect(page).toHaveScreenshot(shot('shell', 'splash', 'launch', theme));
    });

    test('the split between Files and Media, dragged and let go', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await imagesLoaded(sidePane(page));
      const handle = sidePane(page).locator('.bava-splitter-handle');
      const media = sidePane(page).locator('.bava-splitter-panel').last();
      const before = (await media.boundingBox())!.height;
      const box = (await handle.boundingBox())!;
      // The line is one pixel high, and the pointer finds it a few pixels
      // either side: the press is two pixels below it. The drag moves by the
      // same 120 pixels, so it ends where a press on the line would.
      const press = box.y + 2;
      await page.mouse.move(box.x + box.width / 2, press);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, press - 120, { steps: 6 });
      await expect(handle).toHaveAttribute('data-dragging', '');
      await expect.poll(async () => (await media.boundingBox())!.height).toBeGreaterThan(before + 100);
      await shotPane(sidePane(page), shot('shell', 'splitter', 'dragging', theme));
      await page.mouse.up();
      await expect(handle).not.toHaveAttribute('data-dragging', '');
      await restPointer(page);
      await imagesLoaded(sidePane(page));
      await shotPane(sidePane(page), shot('shell', 'splitter', 'dragged', theme));
    });

    test('a pane that failed to draw', async ({ page }) => {
      await openApp(page, theme);
      await fault(page, 'undrawable', '');
      await menu(page, 'file.openSpace');
      const failed = sidePane(page).getByRole('alert');
      await expect(failed).toContainText('This panel hit a problem');
      await expect(failed).toContainText('The Files panel stopped working');
      // Only that pane: the rest of the window carries on.
      await expect(page.getByText('Pick a page in Files, or make a new one.')).toBeVisible();
      await restPointer(page);
      await shotPane(sidePane(page), shot('shell', 'pane', 'failed', theme));
    });
  });

  test.describe(`status notices, ${theme}`, () => {
    test('another unexpected error, after the first was shown', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing/Launch plan.md');
      await emit(page, 'app:error', { id: 'e-7f3a91', kind: 'panic' });
      await openDialog(page).getByRole('button', { name: 'Close' }).click();
      await expect(openDialog(page)).toHaveCount(0);
      await emit(page, 'app:error', { id: 'e-7f3a92', kind: 'panic' });
      await expect(statusMessage(page)).toHaveText('Another error was logged. Help ▸ Open Logs Folder has the details.');
      // Told once by a dialog: after that, only the status bar.
      await expect(openDialog(page)).toHaveCount(0);
      await restPointer(page);
      await shotPane(statusBar(page), shot('shell', 'notice', 'another-error', theme));
    });

    test('autosave paused: the file changed on disk', async ({ page }) => {
      await openApp(page, theme, {}, AUTOSAVE);
      await openPage(page, 'Marketing/Launch plan.md');
      await fault(page, 'changedOnDisk', true);
      await caretOnWord(page, 'thousand');
      await page.keyboard.type('s');
      await expect(statusMessage(page)).toHaveText('Autosave paused: file changed on disk. Save to decide.');
      await expect(page.locator('header .state')).toHaveText('unsaved');
      await restPointer(page);
      await shotPane(statusBar(page), shot('shell', 'notice', 'autosave-paused', theme));
    });

    test('autosave paused: the last save failed', async ({ page }) => {
      await openApp(page, theme, {}, AUTOSAVE);
      await openPage(page, 'Marketing/Launch plan.md');
      await fault(page, 'saveFails', true);
      await caretOnWord(page, 'thousand');
      await page.keyboard.type('s');
      await expect(statusMessage(page)).toHaveText('Autosave paused: the last save failed. Save to retry.');
      await restPointer(page);
      await shotPane(statusBar(page), shot('shell', 'notice', 'autosave-failed', theme));
    });

    test('the settings could not be read', async ({ page }) => {
      await openApp(page, theme, {}, { failSettings: true });
      await expect(statusMessage(page)).toHaveText('Settings could not be read; changes will not be saved.');
      await restPointer(page);
      await shotPane(statusBar(page), shot('shell', 'notice', 'settings-unread', theme));
    });

    test('a setting could not be saved', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await fault(page, 'settingsSaveFails', true);
      await menu(page, 'app.settings');
      await page.getByRole('tab', { name: 'Canvas' }).click();
      await openDialog(page).getByRole('radiogroup').last().getByText('On', { exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(openDialog(page)).toHaveCount(0);
      await expect(statusMessage(page)).toHaveText('That setting could not be saved.');
      await restPointer(page);
      await shotPane(statusBar(page), shot('shell', 'notice', 'setting-unsaved', theme));
    });

    test('a name Go refuses', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing/Launch plan.md');
      await menu(page, 'file.new');
      const field = page.locator('input.rename').filter({ visible: true });
      await expect(field).toBeFocused();
      await field.fill('Brand guide');
      await field.press('Enter');
      await expect(statusMessage(page)).toHaveText('Something with that name is already there.');
      await restPointer(page);
      await shotPane(statusBar(page), shot('shell', 'notice', 'refused', theme));
    });
  });
}
