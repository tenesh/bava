import { expect, test } from '@playwright/test';
import {
  THEMES,
  centreInView,
  dragCells,
  documentPane,
  editor,
  menu,
  menus,
  newLineAtEnd,
  openDocument,
  restPointer,
  rightClick,
  selectWord,
  shot,
  shotFloating,
  shotPane,
} from './helpers';

// What the Document draws: every block, and everything that floats over the
// page, in both themes. What it does is in document-actions.spec.ts.

for (const theme of THEMES) {
  test.describe(`the Document, ${theme}`, () => {
    test('every block and mark', async ({ page }) => {
      await openDocument(page, theme, 'Team handbook.md');
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
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'page', 'everything', theme));
    });

    test('a locked page', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Release checklist.md');
      await expect(editor(page)).toHaveAttribute('contenteditable', 'false');
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'page', 'locked', theme));
    });

    test('an empty line says what to type', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await restPointer(page);
      await expect(editor(page).locator('.is-empty')).toHaveAttribute('data-placeholder', 'Type / for commands');
      await shotPane(documentPane(page), shot('document', 'page', 'placeholder', theme));
    });

    // The shortcuts, typed as a person types them, in a real browser.
    test('typing shortcuts make blocks', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
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
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'page', 'typed', theme));
    });

    test('the / menu', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      // The line typed on: the page keeps another, empty, after it.
      const line = editor(page).locator('p', { hasText: '/' });
      await page.keyboard.type('/');
      await restPointer(page);
      await expect(page.locator('.slash-group')).toHaveText(['Basic', 'Advanced', 'Inline']);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(1);
      await expect(menus(page).locator('[role="option"]').first()).toHaveAttribute('data-highlighted', '');
      await shotFloating(page, line, menus(page), shot('document', 'slash-menu', 'all', theme));
      await page.keyboard.type('head');
      await expect(page.locator('.slash-group')).toHaveText(['Basic']);
      await expect(menus(page).locator('[role="option"]').first()).toHaveAttribute('data-highlighted', '');
      await shotFloating(page, line, menus(page), shot('document', 'slash-menu', 'filtered', theme));
    });

    test('the formatting bubble on a selection', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await selectWord(page, 'thousand');
      const bubble = page.getByRole('toolbar', { name: 'Formatting' });
      await expect(bubble).toBeVisible();
      await restPointer(page);
      await shotFloating(page, editor(page).locator('p', { hasText: 'thousand' }), bubble, shot('document', 'bubble', 'selection', theme));
    });

    test('the bubble from the keyboard', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await selectWord(page, 'thousand');
      const bubble = page.getByRole('toolbar', { name: 'Formatting' });
      // Alt+F10 goes into the bubble a person can see.
      await expect(bubble).toBeVisible();
      await page.keyboard.press('Alt+F10');
      await expect(bubble.getByRole('button').first()).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await restPointer(page);
      await expect(bubble.getByRole('button', { name: 'Bold' })).toBeFocused();
      await shotFloating(page, editor(page).locator('p', { hasText: 'thousand' }), bubble, shot('document', 'bubble', 'keyboard', theme));
    });

    test('the block handle and its menu', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      const block = editor(page).locator('p').first();
      await block.hover();
      const grip = page.getByRole('button', { name: 'Drag, or open the block menu' });
      await expect(grip).toBeVisible();
      await grip.click();
      await expect(menus(page)).toHaveCount(1);
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, block, menus(page), shot('document', 'block-menu', 'open', theme));
    });

    test('every rich block', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Blocks.md');
      await expect(editor(page).locator('.syntax-keyword').first()).toBeVisible();
      await expect(editor(page).locator('.math-block .katex-display')).toHaveCount(1);
      await expect(editor(page).locator('.math-error')).toHaveCount(1);
      await expect(editor(page).locator('.contents a')).toHaveCount(3);
      // A folded toggle hides what it holds.
      await expect(editor(page).getByText('Hidden inside it.')).toBeHidden();
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'block', 'top', theme));
      await editor(page).locator('.footnotes').scrollIntoViewIfNeeded();
      await shotPane(documentPane(page), shot('document', 'block', 'bottom', theme));
    });

    test("a code block's languages", async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Blocks.md');
      const block = editor(page).locator('.code-block');
      await block.hover();
      await editor(page).locator('.code-language').click();
      await expect(menus(page)).toHaveCount(1);
      await restPointer(page);
      await shotFloating(page, block, menus(page), shot('document', 'language-menu', 'open', theme));
    });

    test('editing an equation', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Blocks.md');
      const equation = editor(page).locator('.math-inline').first();
      await equation.click();
      await restPointer(page);
      await expect(page.getByRole('textbox', { name: 'Equation' })).toBeFocused();
      await expect(page.locator('.equation-preview .katex')).toBeVisible();
      await shotFloating(page, equation, page.locator('.equation-field'), shot('document', 'equation-field', 'editing', theme));
    });

    test('emoji by name', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await page.keyboard.type('Go :rocke');
      await restPointer(page);
      const list = page.getByRole('listbox', { name: 'Emoji' });
      await expect(list).toBeVisible();
      await expect(list.locator('[role="option"]').first()).toHaveAttribute('data-highlighted', '');
      await shotFloating(page, editor(page).locator('p', { hasText: ':rocke' }), list, shot('document', 'emoji-menu', 'open', theme));
    });

    test('the emoji picker', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await page.keyboard.type('/emoji');
      await page.keyboard.press('Enter');
      await restPointer(page);
      const picker = page.getByRole('dialog', { name: 'Emoji' });
      await expect(picker).toBeVisible();
      // Anchored on the line it opened from: the caret's line shows the placeholder.
      await shotFloating(page, editor(page).locator('p.is-empty[data-placeholder]'), picker, shot('document', 'emoji-picker', 'default', theme));
    });

    test('images and a video, at each width, shape and alignment', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Media.md');
      // Every image is drawn from its file; the video waits on its poster.
      await expect(editor(page).locator('figure.media[data-kind="image"][data-state="ready"]')).toHaveCount(4);
      await expect(editor(page).locator('figure.media[data-kind="video"] video')).toHaveAttribute('poster', /demo\+poster\.png/);
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'media', 'top', theme));
      await editor(page).getByText('Large, wide').scrollIntoViewIfNeeded();
      await shotPane(documentPane(page), shot('document', 'media', 'middle', theme));
      await editor(page).getByText('Typed after the video.').scrollIntoViewIfNeeded();
      await expect(editor(page).locator('figure.media[data-state="missing"]')).toHaveCount(1);
      await shotPane(documentPane(page), shot('document', 'media', 'bottom', theme));
    });

    test("an image's menu, open at Width", async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Media.md');
      await expect(editor(page).locator('figure.media[data-kind="image"][data-state="ready"]')).toHaveCount(4);
      const image = editor(page).locator('figure.media').first();
      await image.hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      await page.getByRole('menuitem', { name: 'Width' }).click();
      await expect(page.getByRole('menuitem', { name: 'Full width' })).toBeVisible();
      // The pointer stays on Width: moved off, Ark closes the submenu it opened.
      await expect(menus(page)).toHaveCount(2);
      await expect(page.getByRole('menuitem', { name: 'Width', exact: true })).toHaveAttribute('data-highlighted', '');
      await shotFloating(page, image, menus(page), shot('document', 'media-menu', 'image', theme));
    });

    test('an image full screen', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Media.md');
      await expect(editor(page).locator('figure.media[data-kind="image"][data-state="ready"]')).toHaveCount(4);
      await editor(page).locator('figure.media').nth(1).hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      await page.getByRole('menuitem', { name: 'Full screen' }).click();
      await restPointer(page);
      await expect(page.locator('.media-viewer img')).toHaveJSProperty('complete', true);
      await shotPane(page.locator('.media-viewer'), shot('document', 'media', 'full-screen', theme));
    });

    test("a video's menu", async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Media.md');
      const video = editor(page).locator('figure.media').nth(4);
      await centreInView(video);
      await video.hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      await expect(page.getByRole('menuitem', { name: 'Loop' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Turn into' })).toHaveCount(0);
      await expect(page.getByRole('menuitem', { name: 'Full screen' })).toHaveCount(0);
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, video, menus(page), shot('document', 'media-menu', 'video', theme));
    });

    test('cards and an online video', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Media.md');
      const cards = editor(page).locator('.card');
      await expect(cards).toHaveCount(5);
      await expect(cards.nth(0)).toHaveAttribute('data-state', 'ready');
      await expect(cards.nth(0).locator('.card-meta')).toHaveText('242.2 KB');
      await expect(cards.nth(4)).toHaveAttribute('data-state', 'missing');
      // The online video is a placeholder: nothing of it is loaded.
      const online = editor(page).locator('figure.media[data-kind="online"]');
      await expect(online.locator('iframe')).toHaveCount(0);
      await restPointer(page);
      await editor(page).getByRole('heading', { name: 'Cards' }).scrollIntoViewIfNeeded();
      await shotPane(documentPane(page), shot('document', 'card', 'top', theme));
      await online.scrollIntoViewIfNeeded();
      await shotPane(documentPane(page), shot('document', 'card', 'online-video', theme));
    });

    test("a web card's menu, open at Show as", async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Media.md');
      const card = editor(page).locator('.card').nth(3);
      await centreInView(card);
      await card.hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      await page.getByRole('menuitem', { name: 'Show as' }).click();
      await expect(page.getByRole('menuitem', { name: 'Extended card' })).toBeVisible();
      // The pointer stays on Show as: moved off, Ark closes the submenu it opened.
      await expect(menus(page)).toHaveCount(2);
      await expect(page.getByRole('menuitem', { name: 'Show as' })).toHaveAttribute('data-highlighted', '');
      await shotFloating(page, card, menus(page), shot('document', 'card-menu', 'web', theme));
    });

    test('tables in both forms', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Tables.md');
      await expect(editor(page).locator('table')).toHaveCount(2);
      await expect(editor(page).locator('td[colspan="2"]')).toHaveCount(1);
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'table', 'page', theme));
    });

    test('four cells selected, their menu, and merged', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Tables.md');
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
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, table, menus(page), shot('document', 'table-menu', 'cells', theme));
      await page.getByRole('menuitem', { name: 'Merge cells' }).click();
      const merged = table.locator('[colspan="2"][rowspan="2"]');
      await expect(merged).toHaveCount(1);
      await expect(merged).toHaveText('AnaDesignBenBuild');
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'table', 'merged', theme));
    });

    test('a row moved, and the header row switched off', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Tables.md');
      const table = editor(page).locator('table').first();
      await rightClick(page, 'Ben');
      await page.getByRole('menuitem', { name: 'Move row up' }).click();
      await expect(table.locator('tr').nth(1)).toContainText('Ben');
      await rightClick(page, 'Ben');
      await page.getByRole('menuitem', { name: 'Remove header row' }).click();
      await expect(table.locator('th')).toHaveCount(0);
      // Nothing selected and the pointer away, so only the table is in the picture.
      // Held as a person holds it: a press and release in the same instant can
      // leave the cell selection in place.
      await expect(menus(page)).toHaveCount(0);
      await editor(page).locator('h1').click({ delay: 50 });
      await expect(table.locator('.selectedCell')).toHaveCount(0);
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'table', 'moved-no-header', theme));
    });

    test('a new table: no hint in its cells, and a / menu of what goes in a line', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await page.keyboard.type('/table');
      await page.keyboard.press('Enter');
      await expect(editor(page).locator('table th')).toHaveCount(3);
      await expect(editor(page).locator('table .is-empty')).toHaveCount(0);
      await page.keyboard.type('/');
      await restPointer(page);
      await expect(page.locator('.slash-group')).toHaveText(['Inline']);
      await shotFloating(page, editor(page).locator('table').last(), menus(page), shot('document', 'table', 'new-slash', theme));
    });

    test('spreadsheet rows pasted as a table', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await newLineAtEnd(page);
      await editor(page).evaluate((el) => {
        const data = new DataTransfer();
        data.setData('text/plain', 'Task\tOwner\nWrite\tAna\nShip\tBen');
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      });
      await restPointer(page);
      await expect(editor(page).locator('table td')).toHaveCount(4);
      await shotPane(documentPane(page), shot('document', 'table', 'pasted', theme));
    });

    test('a page ending in a table keeps an empty line after it', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Tables.md');
      const last = editor(page).locator('p').last();
      await expect(last).toHaveText('');
      await last.click();
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'table', 'end-line', theme));
    });

    test('the @ menu: dates, then pages', async ({ page }) => {
      await openDocument(page, theme, 'Roadmap.md');
      await newLineAtEnd(page);
      await page.keyboard.type('See @');
      await restPointer(page);
      const list = page.getByRole('listbox', { name: 'Dates and pages' });
      await expect(list.getByRole('option').first()).toContainText('Today');
      await expect(list.getByRole('option').first()).toHaveAttribute('data-highlighted', '');
      await expect(list.getByRole('option', { name: /Launch plan/ })).toBeVisible();
      await shotFloating(page, editor(page).locator('p', { hasText: 'See @' }), list, shot('document', 'mention', 'open', theme));
    });

    test('a date chip and its calendar', async ({ page }) => {
      await openDocument(page, theme, 'Roadmap.md');
      const chip = editor(page).locator('time.date-chip').first();
      await expect(editor(page).locator('time.date-chip')).toHaveText(['2 Oct 2026', 'next Friday']);
      await chip.click();
      await restPointer(page);
      const calendar = page.getByRole('dialog', { name: 'Calendar' });
      await expect(calendar.locator('.month')).toHaveText('October 2026');
      // The chip's own day is the one chosen, and has the focus.
      await expect(calendar.locator('.day[data-selected]')).toHaveText('2');
      await expect(calendar.locator('.day[data-selected]')).toBeFocused();
      await shotFloating(page, chip, calendar, shot('document', 'date-chip', 'calendar', theme));
    });

    test('a link card, and a link to a missing page', async ({ page }) => {
      await openDocument(page, theme, 'Roadmap.md');
      const brand = editor(page).getByText('Brand guide', { exact: true });
      await brand.click();
      await restPointer(page);
      const card = page.getByRole('dialog', { name: 'Link' });
      await expect(card.locator('.address')).toHaveText('Marketing/Brand guide.md');
      await shotFloating(page, brand, card, shot('document', 'link-card', 'page', theme));
      await page.keyboard.press('Escape');
      await expect(card).toBeHidden();
      const brief = editor(page).getByText('Brief', { exact: true });
      await expect(editor(page).locator('.link-missing')).toHaveText('Brief');
      await brief.click();
      await restPointer(page);
      await expect(card.locator('.missing')).toHaveText('Page not found');
      await expect(card.getByRole('button', { name: 'Open' })).toHaveCount(0);
      await shotFloating(page, brief, card, shot('document', 'link-card', 'missing', theme));
    });

    test('Linked from, on a page another links to', async ({ page }) => {
      await openDocument(page, theme, 'Roadmap.md');
      await editor(page).getByText('Brand guide', { exact: true }).click();
      await page.getByRole('dialog', { name: 'Link' }).getByRole('button', { name: 'Open' }).click();
      await expect(page.locator('header')).toContainText('Brand guide');
      await restPointer(page);
      const linked = page.getByRole('navigation', { name: 'Linked from' });
      await expect(linked.getByRole('button')).toHaveText(['Roadmap']);
      await shotPane(documentPane(page), shot('document', 'linked-from', 'one', theme));
    });

    test('the page menu', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      const button = page.getByRole('button', { name: 'Page menu' });
      await button.click();
      await expect(menus(page)).toHaveCount(1);
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, button, menus(page), shot('document', 'page-menu', 'open', theme));
    });

    test('find in the page', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await menu(page, 'edit.find');
      // Typing goes to the find field, never into the page.
      await expect(page.getByRole('searchbox', { name: 'Find' })).toBeFocused();
      await page.keyboard.type('the');
      await restPointer(page);
      await expect(page.getByRole('search')).toContainText('1 of');
      // The match is marked in the page; the bubble is for selections made in it.
      await expect(editor(page).locator('.ProseMirror-active-search-match')).toHaveText('the');
      await expect(editor(page).locator('.ProseMirror-active-search-match')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.getByRole('toolbar', { name: 'Formatting' })).toBeHidden();
      await shotPane(documentPane(page), shot('document', 'find', 'matches', theme));
    });

    for (const width of ['narrow', 'full'] as const) {
      test(`a page at ${width} width`, async ({ page }) => {
        await openDocument(page, theme, 'Team handbook.md');
        await page.getByRole('button', { name: 'Page menu' }).click();
        await page.getByRole('menuitem', { name: 'Page width' }).click();
        await page.getByRole('menuitem', { name: width === 'narrow' ? 'Narrow' : 'Full' }).click();
        await expect(menus(page)).toHaveCount(0);
        await restPointer(page);
        await shotPane(documentPane(page), shot('document', 'page', `width-${width}`, theme));
      });
    }
  });
}
