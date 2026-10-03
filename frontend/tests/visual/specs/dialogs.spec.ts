import { expect, test } from '@playwright/test';
import {
  PARENT,
  THEMES,
  anotherSpace,
  newSpaceFromSwitcher,
  caretOnWord,
  emit,
  emptyTrash,
  fault,
  imagesLoaded,
  menu,
  openApp,
  openDialog,
  openExport,
  openPage,
  openSpace,
  restPointer,
  shot,
  shotDialog,
  shotPane,
  statusBar,
  statusMessage,
} from './helpers';

/** The log file of a session that ended unexpectedly, as Go names it. */
const LAST_SESSION = '2026-09-26T18-42-07-4182.log';


for (const theme of THEMES) {
  test.describe(`dialogs, ${theme}`, () => {
    test('New Space', async ({ page }) => {
      await openApp(page, theme);
      await page.getByRole('button', { name: 'New Space' }).click();
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'new-space', 'empty', theme));
    });

    test('Space settings', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'file.spaceSettings');
      // It opens on the name, not on its close button.
      await expect(page.locator('#space-name')).toBeFocused();
      await shotDialog(page, shot('dialogs', 'space-settings', 'default', theme));
    });

    test('the Trash, with items', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'space.trash');
      await expect(openDialog(page).locator('li.item')).toHaveCount(2);
      // It opens on the search field, never on Empty Trash.
      await expect(openDialog(page).locator('input[type="search"]')).toBeFocused();
      await shotDialog(page, shot('dialogs', 'trash', 'with-items', theme));
    });

    test('the Media dialog', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.getByRole('button', { name: 'Open Media' }).click();
      const dialog = openDialog(page);
      await expect(dialog.locator('.media-item')).toHaveCount(9);
      // Which pages use each file is read from the pages: Unused follows.
      await expect(dialog.locator('.media-item').filter({ hasText: 'Unused' })).toHaveCount(2);
      await imagesLoaded(dialog);
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'media', 'grid', theme));
      await dialog.locator('[data-name="logo.png"]').click();
      await restPointer(page);
      await expect(dialog.locator('.media-used-by button')).toHaveText(['Media']);
      await shotDialog(page, shot('dialogs', 'media', 'chosen', theme));
      await dialog.getByText('List', { exact: true }).click();
      await dialog.getByText('Unused', { exact: true }).click();
      await restPointer(page);
      await expect(dialog.locator('.media-item')).toHaveCount(2);
      await shotDialog(page, shot('dialogs', 'media', 'unused-list', theme));
    });

    test('deleting a file pages use asks first', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.getByRole('button', { name: 'Open Media' }).click();
      await expect(openDialog(page).locator('.media-item').filter({ hasText: 'Unused' })).toHaveCount(2);
      // Every thumbnail drawn first: one that loads late repaints the dialog under the question.
      await imagesLoaded(openDialog(page));
      await openDialog(page).locator('[data-name="logo.png"]').click();
      await openDialog(page).getByRole('button', { name: 'Delete', exact: true }).click();
      const confirm = openDialog(page).filter({ hasText: 'Delete “logo.png”?' });
      await expect(confirm).toBeVisible();
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'media', 'confirm-delete', theme), confirm);
    });

    test('unused files moved to the Trash, and listed there', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.getByRole('button', { name: 'Open Media' }).click();
      await expect(openDialog(page).locator('.media-item').filter({ hasText: 'Unused' })).toHaveCount(2);
      await page.getByRole('button', { name: 'Move unused to Trash' }).click();
      await expect(page.getByText('Move 2 unused files to the Trash?')).toBeVisible();
      await page.getByRole('button', { name: 'Move unused to Trash' }).last().click();
      await expect(openDialog(page).locator('.media-item')).toHaveCount(7);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Media' })).toBeHidden();
      await menu(page, 'space.trash');
      await expect(openDialog(page).locator('li.item')).toHaveCount(4);
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'trash', 'with-attachments', theme));
    });

    test('the Trash, empty', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await emptyTrash(page);
      await menu(page, 'space.trash');
      await expect(openDialog(page).locator('li.item')).toHaveCount(0);
      await shotDialog(page, shot('dialogs', 'trash', 'empty', theme));
    });

    test('confirming a delete from the Trash', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'space.trash');
      await openDialog(page).locator('li.item').first().hover();
      await page.getByRole('button', { name: /^Delete Q3 retro$/ }).click();
      const confirm = openDialog(page).filter({ hasText: 'for good?' });
      await expect(confirm).toBeVisible();
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'confirm', 'delete-forever', theme), confirm);
    });

    test('Keyboard shortcuts', async ({ page }) => {
      await openApp(page, theme);
      await menu(page, 'help.shortcuts');
      await shotDialog(page, shot('dialogs', 'shortcuts', 'default', theme));
    });

    test('About', async ({ page }) => {
      await openApp(page, theme);
      await menu(page, 'help.about');
      await shotDialog(page, shot('dialogs', 'about', 'default', theme));
    });

    test('an unexpected error', async ({ page }) => {
      await openApp(page, theme);
      await emit(page, 'app:error', { id: 'e-7f3a91', kind: 'panic' });
      await shotDialog(page, shot('dialogs', 'error', 'with-details', theme));
    });

    test('Export', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Engineering/Architecture.md');
      await menu(page, 'file.export');
      await expect(openDialog(page)).toBeVisible();
      // The preview fits its frame whole: nothing cut off at an edge.
      const fits = await page.evaluate(() => {
        const frame = document.querySelector('.preview-frame')!.getBoundingClientRect();
        const svg = document.querySelector('.bava-export-preview svg')!.getBoundingClientRect();
        return svg.top >= frame.top - 0.5 && svg.bottom <= frame.bottom + 0.5 && svg.left >= frame.left - 0.5 && svg.right <= frame.right + 0.5;
      });
      expect(fits).toBe(true);
      await shotDialog(page, shot('dialogs', 'export', 'canvas', theme));
    });

    test('Diagram from Code', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Engineering/Architecture.md');
      await menu(page, 'insert.diagram');
      await expect(openDialog(page)).toBeVisible();
      // The dialog opens with the code in focus: pictured once it is there.
      await expect(openDialog(page).locator('.cm-content')).toBeFocused();
      // The editor follows the theme: its gutter and current line are no
      // lighter than the page in dark, no darker in light.
      const shades = await page.evaluate(() => {
        const lum = (el: Element | null) => {
          const [r, g, b] = (getComputedStyle(el!).backgroundColor.match(/[\d.]+/g) ?? ['0', '0', '0']).map(Number);
          const alpha = Number(getComputedStyle(el!).backgroundColor.match(/[\d.]+/g)?.[3] ?? 1);
          return { lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, alpha };
        };
        const parts = ['.cm-gutters', '.cm-activeLine', '.cm-activeLineGutter'];
        return parts
          .map((part) => document.querySelector(`.bava-dialog-content ${part}`))
          .filter((el): el is Element => el !== null)
          .map((el) => ({ part: el.className, ...lum(el) }));
      });
      expect(shades.length).toBeGreaterThan(0);
      for (const shade of shades) {
        if (shade.alpha > 0.5) expect(theme === 'dark' ? shade.lum < 0.35 : shade.lum > 0.65).toBe(true);
      }
      await shotDialog(page, shot('dialogs', 'diagram', 'empty', theme));
    });
  });

  test.describe(`unexpected errors, ${theme}`, () => {
    test('a failure the page left unhandled', async ({ page }) => {
      await openApp(page, theme);
      await page.evaluate(() => {
        void Promise.reject(new TypeError('nothing caught this'));
      });
      await expect(openDialog(page)).toContainText('Something went wrong');
      // Its kind, never its message: a message can quote the user's work.
      await expect(openDialog(page).locator('dd')).toHaveText(['TypeError']);
      await expect(openDialog(page)).not.toContainText('nothing caught this');
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'error', 'page', theme));
    });

    test('the last session closed unexpectedly, with its log', async ({ page }) => {
      await openApp(page, theme, {}, { notices: [{ kind: 'unexpectedExit', session: LAST_SESSION }] });
      await expect(openDialog(page)).toContainText('Bava closed unexpectedly');
      await expect(openDialog(page).locator('dd')).toHaveText([LAST_SESSION]);
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'error', 'unexpected-exit', theme));
    });

    test('the last session closed unexpectedly, with no log', async ({ page }) => {
      await openApp(page, theme, {}, { notices: [{ kind: 'unexpectedExit', session: '' }] });
      await expect(openDialog(page)).toContainText('Bava closed unexpectedly');
      // Nothing to copy: no details, and no button for them.
      await expect(openDialog(page).getByRole('button', { name: 'Copy details' })).toHaveCount(0);
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'error', 'unexpected-exit-no-log', theme));
    });

    test('the window was reloaded', async ({ page }) => {
      await openApp(page, theme, {}, { notices: [{ kind: 'webviewReloaded', session: '' }] });
      await expect(openDialog(page)).toContainText('The window was reloaded');
      // The body says what happened: no details box, and nothing to copy.
      await expect(openDialog(page).locator('dd')).toHaveCount(0);
      await expect(openDialog(page).getByRole('button', { name: 'Copy details' })).toHaveCount(0);
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'error', 'webview-reloaded', theme));
    });
  });

  test.describe(`dialogs in each state, ${theme}`, () => {
    test('New Space, named and placed', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await newSpaceFromSwitcher(page);
      const dialog = openDialog(page);
      await expect(dialog).toContainText(PARENT);
      await dialog.getByRole('textbox').fill('Thesis');
      await expect(dialog.getByRole('button', { name: 'Create' })).toBeEnabled();
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'new-space', 'ready', theme));
    });

    test('New Space with a name taken', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await newSpaceFromSwitcher(page);
      await openDialog(page).getByRole('textbox').fill('Acme Product');
      await openDialog(page).getByRole('button', { name: 'Create' }).click();
      // Told under the name, in the dialog, which stays with what was typed to try another.
      await expect(openDialog(page).getByRole('alert')).toHaveText('Something with that name is already there.');
      await expect(openDialog(page).getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
      await expect(openDialog(page).getByRole('textbox')).toHaveValue('Acme Product');
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'new-space', 'name-taken', theme));
    });

    test('New Space with a name no folder can have', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await newSpaceFromSwitcher(page);
      await openDialog(page).getByRole('textbox').fill('Q3/Q4');
      await openDialog(page).getByRole('button', { name: 'Create' }).click();
      await expect(openDialog(page).getByRole('alert')).toHaveText('A name cannot hold / or \\.');
      await expect(openDialog(page).getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'new-space', 'bad-name', theme));
    });

    test('Space settings with the name emptied', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'file.spaceSettings');
      await page.locator('#space-name').fill('');
      await expect(openDialog(page).getByRole('button', { name: 'Save' })).toBeDisabled();
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'space-settings', 'empty-name', theme));
    });

    test('Space settings changed', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'file.spaceSettings');
      await page.locator('#space-name').fill('Acme Launch');
      await openDialog(page).getByText('Narrow', { exact: true }).click();
      await expect(openDialog(page).getByRole('radio', { name: 'Narrow' })).toBeChecked();
      await page.locator('#space-name').focus();
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'space-settings', 'changed', theme));
    });

    test('Space settings with a name another Space has', async ({ page }) => {
      await openApp(page, theme);
      await anotherSpace(page, 'Thesis');
      await openSpace(page);
      await menu(page, 'file.spaceSettings');
      await page.locator('#space-name').fill('Thesis');
      await openDialog(page).getByRole('button', { name: 'Save' }).click();
      await expect(openDialog(page)).toHaveCount(0);
      await expect(statusMessage(page)).toHaveText('Something with that name is already there.');
      await expect(page.locator('.bava-space-switcher')).toContainText('Acme Product');
      await restPointer(page);
      await shotPane(statusBar(page), shot('dialogs', 'space-settings', 'name-taken', theme));
    });

    test('Diagram from Code with code D2 cannot read', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Engineering/Architecture.md');
      await menu(page, 'insert.diagram');
      const code = openDialog(page).locator('.cm-content');
      await expect(code).toBeFocused();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type('api -> db\ndb: {\n  shape: cylinder\n');
      await expect(openDialog(page).locator('.errors li')).toHaveText(['maps must be terminated with }'].map((text) => new RegExp(text)));
      await expect(openDialog(page).getByRole('button', { name: 'Insert' })).toBeDisabled();
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'diagram', 'error', theme));
    });

    test('Export with no background', async ({ page }) => {
      const dialog = await openExport(page, theme);
      await dialog.getByText('Background', { exact: true }).click();
      await expect(dialog.getByRole('checkbox', { name: 'Background' })).not.toBeChecked();
      // A press on the label rings nothing: the ring is for the keyboard.
      await expect(dialog.locator('.bava-toggle:has(input:focus-visible)')).toHaveCount(0);
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'export', 'no-background', theme));
    });

    test('Export in dark', async ({ page }) => {
      const dialog = await openExport(page, theme);
      await dialog.getByText('Dark mode', { exact: true }).click();
      await expect(dialog.getByRole('checkbox', { name: 'Dark mode' })).toBeChecked();
      // A press on the label rings nothing: the ring is for the keyboard.
      await expect(dialog.locator('.bava-toggle:has(input:focus-visible)')).toHaveCount(0);
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'export', 'dark-mode', theme));
    });

    // 2× is where it starts, as `export--canvas` has it.
    for (const scale of ['1', '3']) {
      test(`Export at ${scale}×`, async ({ page }) => {
        const dialog = await openExport(page, theme);
        await dialog.getByText(`${scale}×`, { exact: true }).click();
        await expect(dialog.getByRole('radio', { name: `${scale}×` })).toBeChecked();
        await restPointer(page);
        await shotDialog(page, shot('dialogs', 'export', `scale-${scale}`, theme));
      });
    }

    test('Export with something selected', async ({ page }) => {
      const dialog = await openExport(page, theme, true);
      const only = dialog.getByRole('checkbox', { name: 'Only selected' });
      await expect(only).toBeEnabled();
      await expect(only).not.toBeChecked();
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'export', 'selection', theme));
      await dialog.getByText('Only selected', { exact: true }).click();
      await expect(only).toBeChecked();
      await expect(dialog.locator('.bava-toggle:has(input:focus-visible)')).toHaveCount(0);
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'export', 'only-selected', theme));
    });

    test('renaming a file in Media, and a name another file has', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await page.getByRole('button', { name: 'Open Media' }).click();
      const dialog = openDialog(page);
      await imagesLoaded(dialog);
      await dialog.locator('[data-name="logo.png"]').click();
      await dialog.getByRole('button', { name: 'Rename' }).click();
      const field = dialog.locator('.media-rename');
      await expect(field).toBeFocused();
      await expect(field).toHaveValue('logo');
      await restPointer(page);
      await imagesLoaded(dialog);
      await shotDialog(page, shot('dialogs', 'media', 'renaming', theme));
      await field.fill('landscape');
      await field.press('Enter');
      // Told under the field, which stays open with the name to try another.
      await expect(dialog.getByRole('alert')).toHaveText('Something with that name is already there.');
      await expect(field).toHaveAttribute('aria-invalid', 'true');
      await expect(field).toHaveValue('landscape');
      await expect(dialog.locator('[data-name="logo.png"]')).toBeVisible();
      await restPointer(page);
      await imagesLoaded(dialog);
      await shotDialog(page, shot('dialogs', 'media', 'name-taken', theme));
    });

    test('leaving a page with changes not saved', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing/Launch plan.md');
      await caretOnWord(page, 'thousand');
      await page.keyboard.type('s');
      await expect(page.locator('header .state')).toHaveText('unsaved');
      await page.locator('[data-path="Roadmap.md"]').click();
      await expect(openDialog(page)).toContainText('Unsaved changes');
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'confirm', 'unsaved', theme));
    });

    test('saving over a file another program changed', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing/Launch plan.md');
      await caretOnWord(page, 'thousand');
      await page.keyboard.type('s');
      await fault(page, 'changedOnDisk', true);
      await menu(page, 'file.save');
      await expect(openDialog(page)).toContainText('This file changed on disk');
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'confirm', 'conflict', theme));
    });

    test('the Trash searched, and nothing matching', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'space.trash');
      const search = openDialog(page).locator('input[type="search"]');
      await search.fill('retro');
      await expect(openDialog(page).locator('li.item')).toHaveCount(1);
      await shotDialog(page, shot('dialogs', 'trash', 'searching', theme));
      await search.fill('zzz');
      await expect(openDialog(page).getByText('Nothing matches.')).toBeVisible();
      await shotDialog(page, shot('dialogs', 'trash', 'no-match', theme));
    });

    test('confirming Empty Trash', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await menu(page, 'space.trash');
      await openDialog(page).getByRole('button', { name: 'Empty Trash' }).click();
      const confirm = openDialog(page).filter({ hasText: 'Empty the Trash?' });
      await expect(confirm).toBeVisible();
      await restPointer(page);
      await shotDialog(page, shot('dialogs', 'confirm', 'empty-trash', theme), confirm);
    });
  });
}
