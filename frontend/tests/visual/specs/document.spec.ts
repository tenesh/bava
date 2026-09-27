import { expect, test, type Page } from '@playwright/test';
import { THEMES, menu, openApp, openPage, shot, type Theme } from './helpers';

const pane = (page: Page) => page.locator('[data-side="document"]');
const editor = (page: Page) => page.locator('.bava-doc');

/** Opens a page in the Document view. */
async function openDocument(page: Page, theme: Theme, folder: string, path: string) {
  await openApp(page, theme);
  await openPage(page, folder, path);
  await menu(page, 'view.document');
  await expect(editor(page)).toBeVisible();
}

/** Puts the caret on a new empty line after the page's last text. */
async function newLineAtEnd(page: Page) {
  await editor(page).locator('p').last().click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
}

/** Selects one word of the page, as a double-click on it would. */
async function selectWord(page: Page, word: string) {
  const box = await page.evaluate((w) => {
    const walker = document.createTreeWalker(document.querySelector('.bava-doc')!, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent!.indexOf(w);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + w.length);
      const r = range.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, word);
  await page.mouse.dblclick(box!.x, box!.y);
}

for (const theme of THEMES) {
  test.describe(`the Document, ${theme}`, () => {
    test('every block and mark', async ({ page }) => {
      await openDocument(page, theme, '', 'Team handbook.md');
      await expect(editor(page).locator('li[data-checked="true"]')).toHaveCount(1);
      // A to-do's box sits on its line, level with the text's first line.
      const item = editor(page).locator('li[data-checked="false"]');
      const box = (await item.locator('.todo-box').boundingBox())!;
      const line = (await item.locator('p').boundingBox())!;
      expect(Math.abs(box.y + box.height / 2 - (line.y + Math.min(line.height, 24) / 2))).toBeLessThan(2);
      // A paragraph after a heading is set apart from it.
      const title = (await editor(page).locator('h1').boundingBox())!;
      const intro = (await editor(page).locator('p').first().boundingBox())!;
      expect(intro.y - (title.y + title.height)).toBeGreaterThanOrEqual(8);
      await expect(pane(page)).toHaveScreenshot(shot('document', 'page', 'everything', theme));
    });

    test('a locked page', async ({ page }) => {
      await openDocument(page, theme, 'Engineering', 'Engineering/Release checklist.md');
      await expect(editor(page)).toHaveAttribute('contenteditable', 'false');
      await expect(pane(page)).toHaveScreenshot(shot('document', 'page', 'locked', theme));
    });

    test('an empty line says what to type', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await expect(editor(page).locator('.is-empty')).toHaveAttribute('data-placeholder', 'Type / for commands');
      await expect(pane(page)).toHaveScreenshot(shot('document', 'page', 'placeholder', theme));
    });

    // The shortcuts, typed as a person types them, in a real browser.
    test('typing shortcuts make blocks', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await page.keyboard.type('## Goals');
      await page.keyboard.press('Enter');
      await page.keyboard.type('- One');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Two');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('[] Ship it');
      await expect(editor(page).locator('h2')).toHaveText('Goals');
      await expect(editor(page).locator('ul').first().locator('li')).toHaveCount(2);
      await expect(editor(page).locator('li[data-checked="false"]')).toHaveCount(1);
      await expect(page.locator('header')).toContainText('unsaved');
      await expect(pane(page)).toHaveScreenshot(shot('document', 'page', 'typed', theme));
    });

    test('the / menu', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await page.keyboard.type('/head');
      await expect(page.locator('.slash-menu')).toBeVisible();
      await expect(page).toHaveScreenshot(shot('document', 'slash-menu', 'filtered', theme));
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Chosen');
      await expect(editor(page).locator('h2')).toHaveText('Chosen');
    });

    test('the formatting bubble on a selection', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await selectWord(page, 'thousand');
      await expect(page.getByRole('toolbar', { name: 'Formatting' })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('document', 'bubble', 'open', theme));
      await page.getByRole('button', { name: 'Bold' }).click();
      await expect(editor(page).locator('strong')).toHaveCount(1);
    });

    test('the block handle and its menu', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await editor(page).locator('p').first().hover();
      const grip = page.getByRole('button', { name: 'Drag, or open the block menu' });
      await expect(grip).toBeVisible();
      await grip.click();
      await expect(page.locator('.bava-menu').filter({ visible: true })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('document', 'block-menu', 'open', theme));
    });

    test('the block menu and the bubble from the keyboard', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await selectWord(page, 'thousand');
      await page.keyboard.press('Alt+F10');
      const bubble = page.getByRole('toolbar', { name: 'Formatting' });
      await expect(bubble.getByRole('button').first()).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(bubble.getByRole('button', { name: 'Bold' })).toBeFocused();
      await expect(page).toHaveScreenshot(shot('document', 'bubble', 'keyboard', theme));
      await page.keyboard.press('Enter');
      await expect(editor(page).locator('strong')).toHaveText('thousand');
      // The command gives focus back to the page.
      await expect(editor(page)).toBeFocused();
      await page.keyboard.press('ControlOrMeta+/');
      await expect(page.locator('.bava-menu').filter({ visible: true })).toBeVisible();
      // The menu takes the keys once it has focus; Escape gives it back.
      await expect(page.locator('.bava-menu:focus-within, .bava-menu:focus')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(editor(page)).toBeFocused();
    });

    test('the page menu', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await page.getByRole('button', { name: 'Page menu' }).click();
      await expect(page.locator('.bava-menu').filter({ visible: true })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('document', 'page-menu', 'open', theme));
    });

    test('find in the page', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await menu(page, 'edit.find');
      // Typing goes to the find field, never into the page.
      await expect(page.getByRole('searchbox', { name: 'Find' })).toBeFocused();
      await page.keyboard.type('the');
      await expect(page.getByRole('search')).toContainText('1 of');
      // The match is marked in the page; the bubble is for selections made in it.
      await expect(editor(page).locator('.ProseMirror-active-search-match')).toHaveText('the');
      await expect(editor(page).locator('.ProseMirror-active-search-match')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.getByRole('toolbar', { name: 'Formatting' })).toBeHidden();
      await expect(pane(page)).toHaveScreenshot(shot('document', 'find', 'matches', theme));
    });
  });
}

// Widths: the same page at each, in one theme (the width is not a colour).
for (const width of ['narrow', 'full'] as const) {
  test(`a page at ${width} width`, async ({ page }) => {
    await openDocument(page, 'light', '', 'Team handbook.md');
    await page.getByRole('button', { name: 'Page menu' }).click();
    await page.getByRole('menuitem', { name: 'Page width' }).click();
    await page.getByRole('menuitem', { name: width === 'narrow' ? 'Narrow' : 'Full' }).click();
    await expect(pane(page)).toHaveScreenshot(shot('document', 'page', `width-${width}`, 'light'));
  });
}
