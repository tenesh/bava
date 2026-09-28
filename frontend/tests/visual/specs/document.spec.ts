import { expect, test, type Locator, type Page } from '@playwright/test';
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
  const last = editor(page).locator('p').last();
  await last.click();
  // The caret at the paragraph's very end, placed directly: End stops at the
  // end of a wrapped line, and the click can land anywhere in the text. The
  // editor settles the click's own caret just after the mouse is released, so
  // the caret is placed again until it holds.
  await expect(async () => {
    await last.evaluate((p) => {
      const range = document.createRange();
      range.selectNodeContents(p);
      range.collapse(false);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
    });
    await page.waitForTimeout(100);
    const seen = await last.evaluate((p) => {
      const selection = document.getSelection()!;
      if (!selection.isCollapsed || !p.contains(selection.anchorNode)) return 'outside';
      const after = document.createRange();
      after.setStart(selection.anchorNode!, selection.anchorOffset);
      after.setEnd(p, p.childNodes.length);
      return after.toString() === '' ? 'end' : 'inside';
    });
    expect(seen).toBe('end');
  }).toPass();
  await page.keyboard.press('Enter');
}

/** Drags across table cells, from the one holding `from` to the one holding `to`. */
async function dragCells(page: Page, from: string, to: string) {
  // Positions are read once the page's fonts have settled.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const start = (await editor(page).getByText(from, { exact: true }).first().boundingBox())!;
  const end = (await editor(page).getByText(to, { exact: true }).first().boundingBox())!;
  await page.mouse.move(start.x + 4, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + 4, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();
}

/** A right-click on the cell holding `text`, or on the element given. */
async function rightClick(page: Page, target: string | Locator) {
  // As a person would: once any menu open before has closed.
  await expect(page.locator('.bava-menu').filter({ visible: true })).toHaveCount(0);
  const where = typeof target === 'string' ? editor(page).getByText(target, { exact: true }).first() : target;
  const box = (await where.boundingBox())!;
  await page.mouse.click(box.x + 4, box.y + box.height / 2, { button: 'right' });
  await expect(page.locator('.bava-menu').filter({ visible: true })).toBeVisible();
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
      await page.keyboard.type('/');
      await expect(page.locator('.slash-group')).toHaveText(['Basic', 'Advanced', 'Inline']);
      await expect(page).toHaveScreenshot(shot('document', 'slash-menu', 'all', theme));
      await page.keyboard.type('head');
      await expect(page.locator('.slash-group')).toHaveText(['Basic']);
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
      const bubble = page.getByRole('toolbar', { name: 'Formatting' });
      // Alt+F10 goes into the bubble a person can see.
      await expect(bubble).toBeVisible();
      await page.keyboard.press('Alt+F10');
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

    test('every rich block', async ({ page }) => {
      await openDocument(page, theme, 'Engineering', 'Engineering/Blocks.md');
      await expect(editor(page).locator('.syntax-keyword').first()).toBeVisible();
      await expect(editor(page).locator('.math-block .katex-display')).toHaveCount(1);
      await expect(editor(page).locator('.math-error')).toHaveCount(1);
      await expect(editor(page).locator('.contents a')).toHaveCount(4);
      // A folded toggle and toggle heading hide what they hold.
      await expect(editor(page).getByText('Hidden inside it.')).toBeHidden();
      await expect(editor(page).getByText('Hidden under its heading.')).toBeHidden();
      await expect(pane(page)).toHaveScreenshot(shot('document', 'blocks', 'top', theme));
      await editor(page).locator('.footnotes').scrollIntoViewIfNeeded();
      await expect(pane(page)).toHaveScreenshot(shot('document', 'blocks', 'bottom', theme));
    });

    test('unfolding a toggle heading', async ({ page }) => {
      await openDocument(page, theme, 'Engineering', 'Engineering/Blocks.md');
      await editor(page).locator('h2 .toggle-arrow').first().click();
      await expect(editor(page).getByText('Hidden under its heading.')).toBeVisible();
      await expect(page.locator('header')).not.toContainText('unsaved');
    });

    test('a code block keeps its height as the pointer passes', async ({ page }) => {
      await openDocument(page, theme, '', 'Team handbook.md');
      const block = editor(page).locator('.code-block');
      await page.mouse.move(0, 0);
      const before = (await block.boundingBox())!.height;
      await block.hover();
      await expect(block.locator('.code-copy')).toBeVisible();
      expect((await block.boundingBox())!.height).toBe(before);
    });

    test("a code block's languages", async ({ page }) => {
      await openDocument(page, theme, 'Engineering', 'Engineering/Blocks.md');
      await editor(page).locator('.code-block').hover();
      await editor(page).locator('.code-language').click();
      await expect(page.locator('.bava-menu').filter({ visible: true })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('document', 'code-languages', 'open', theme));
    });

    test('editing an equation', async ({ page }) => {
      await openDocument(page, theme, 'Engineering', 'Engineering/Blocks.md');
      await editor(page).locator('.math-inline').first().click();
      const field = page.getByRole('textbox', { name: 'Equation' });
      await expect(field).toBeFocused();
      await expect(page.locator('.equation-preview .katex')).toBeVisible();
      await expect(page).toHaveScreenshot(shot('document', 'equation-field', 'open', theme));
      await field.fill('\\pi d');
      await page.keyboard.press('Enter');
      await expect(page.locator('header')).toContainText('unsaved');
    });

    test('emoji by name and from the picker', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await page.keyboard.type('Go :rocke');
      await expect(page.getByRole('listbox', { name: 'Emoji' })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('document', 'emoji-suggestions', 'open', theme));
      await page.keyboard.press('Enter');
      await expect(editor(page)).toContainText('Go 🚀');
      await page.keyboard.type(' /emoji');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Emoji' })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('document', 'emoji-picker', 'open', theme));
      await page.getByRole('button', { name: 'party popper' }).click();
      await expect(editor(page)).toContainText('🎉');
    });

    test('Turn into offers only its own family', async ({ page }) => {
      await openDocument(page, theme, '', 'Team handbook.md');
      const openMenu = async (text: string) => {
        await editor(page).getByText(text).first().hover();
        await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
        await expect(page.locator('.bava-menu').filter({ visible: true })).toBeVisible();
      };
      await openMenu('Files are the source of truth');
      await expect(page.getByRole('menuitem', { name: 'Turn into' })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await openMenu('Ship small');
      await page.getByRole('menuitem', { name: 'Turn into' }).click();
      await expect(page.getByRole('menuitem', { name: 'Numbered list' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Heading 1' })).toHaveCount(0);
    });

    test('tables in both forms', async ({ page }) => {
      await openDocument(page, theme, 'Engineering', 'Engineering/Tables.md');
      await expect(editor(page).locator('table')).toHaveCount(2);
      await expect(editor(page).locator('td[colspan="2"]')).toHaveCount(1);
      await expect(pane(page)).toHaveScreenshot(shot('document', 'tables', 'page', theme));
    });

    test('merging cells across rows and columns, and splitting them', async ({ page }) => {
      await openDocument(page, theme, 'Engineering', 'Engineering/Tables.md');
      const table = editor(page).locator('table').first();
      await dragCells(page, 'Ana', 'Build');
      await expect(table.locator('.selectedCell')).toHaveCount(4);
      await rightClick(page, 'Build');
      // The right-click keeps the four cells selected, and the menu offers merging them.
      await expect(table.locator('.selectedCell')).toHaveCount(4);
      await expect(page.getByRole('menuitem', { name: 'Merge cells' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Split cell' })).toHaveCount(0);
      await expect(page.getByRole('menuitem', { name: 'Move row up' })).toHaveCount(0);
      await expect(page.getByRole('menuitem', { name: 'Delete rows' })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('document', 'table-menu', 'cells', theme));
      await page.getByRole('menuitem', { name: 'Merge cells' }).click();
      const merged = table.locator('[colspan="2"][rowspan="2"]');
      await expect(merged).toHaveCount(1);
      await expect(merged).toHaveText('AnaDesignBenBuild');
      await expect(pane(page)).toHaveScreenshot(shot('document', 'table', 'merged', theme));
      await rightClick(page, merged);
      await expect(page.getByRole('menuitem', { name: 'Split cell' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Merge cells' })).toHaveCount(0);
      await page.getByRole('menuitem', { name: 'Split cell' }).click();
      await expect(table.locator('[colspan="2"]')).toHaveCount(0);
      await expect(table.locator('tr').nth(1).locator('td')).toHaveCount(3);
    });

    test('merging a header with body cells is not offered', async ({ page }) => {
      await openDocument(page, theme, 'Engineering', 'Engineering/Tables.md');
      await dragCells(page, 'Name', 'Ana');
      await expect(editor(page).locator('.selectedCell')).toHaveCount(2);
      await rightClick(page, 'Ana');
      await expect(page.getByRole('menuitem', { name: 'Insert row above' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Merge cells' })).toHaveCount(0);
    });

    test('moving a row, and the header row switched off', async ({ page }) => {
      await openDocument(page, theme, 'Engineering', 'Engineering/Tables.md');
      const table = editor(page).locator('table').first();
      await rightClick(page, 'Name');
      await expect(page.getByRole('menuitem', { name: 'Move row down' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Move row up' })).toHaveCount(0);
      await page.keyboard.press('Escape');
      await rightClick(page, 'Ben');
      await page.getByRole('menuitem', { name: 'Move row up' }).click();
      await expect(table.locator('tr').nth(1)).toContainText('Ben');
      await rightClick(page, 'Ben');
      await page.getByRole('menuitem', { name: 'Remove header row' }).click();
      await expect(table.locator('th')).toHaveCount(0);
      // Nothing selected and the pointer away, so only the table is in the picture.
      await editor(page).locator('h1').click();
      await page.mouse.move(0, 0);
      await expect(pane(page)).toHaveScreenshot(shot('document', 'table', 'moved-no-header', theme));
    });

    test('a new table: no hint in its cells, and a / menu of what goes in a line', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await page.keyboard.type('/table');
      await page.keyboard.press('Enter');
      await expect(editor(page).locator('table th')).toHaveCount(3);
      await expect(editor(page).locator('table .is-empty')).toHaveCount(0);
      await page.keyboard.type('/');
      await expect(page.locator('.slash-group')).toHaveText(['Inline']);
      await expect(page).toHaveScreenshot(shot('document', 'table', 'new-slash', theme));
    });

    test('resizing a column and adding a row', async ({ page }) => {
      await openDocument(page, theme, 'Engineering', 'Engineering/Tables.md');
      const cell = editor(page).locator('table').first().locator('th').first();
      const box = (await cell.boundingBox())!;
      await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2);
      // The handle runs down the whole column, a piece in each row.
      await expect(editor(page).locator('.column-resize-handle').first()).toBeVisible();
      await page.mouse.down();
      await page.mouse.move(box.x + box.width + 80, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
      expect((await cell.boundingBox())!.width).toBeGreaterThan(box.width + 40);
      const rows = await editor(page).locator('table').first().locator('tr').count();
      await editor(page).locator('table').first().hover();
      await editor(page).locator('.table-edge-row').first().click();
      await expect(editor(page).locator('table').first().locator('tr')).toHaveCount(rows + 1);
    });

    test('pasting spreadsheet rows', async ({ page }) => {
      await openDocument(page, theme, 'Marketing', 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await editor(page).evaluate((el) => {
        const data = new DataTransfer();
        data.setData('text/plain', 'Task\tOwner\nWrite\tAna\nShip\tBen');
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      });
      await expect(editor(page).locator('table td')).toHaveCount(4);
      await expect(page).toHaveScreenshot(shot('document', 'table-pasted', 'open', theme));
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
