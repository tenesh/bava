import { expect, test } from '@playwright/test';
import { SUBJECTS } from '../fixtures/document-blocks';
import {
  caretInCell,
  centreInView,
  documentPane,
  dragCells,
  editor,
  imagesLoaded,
  menu,
  menus,
  newLineAtEnd,
  openDocument,
  openSeeded,
  personPace,
  restPointer,
  rightClick,
  selectWord,
} from '../helpers';

// What the Document does, typed and clicked as a person would, checked on
// the page. What it looks like is in document.spec.ts.

test.describe('blocks', () => {
  test('a / menu choice turns the line into that block', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await newLineAtEnd(page);
    await page.keyboard.type('/head');
    await expect(page.locator('.slash-group')).toHaveText(['Basic']);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Chosen');
    await expect(editor(page).locator('h2')).toHaveText('Chosen');
  });

  test('unfolding a toggle shows what it holds and leaves the page saved', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Blocks.md');
    await expect(editor(page).getByText('Hidden inside it.')).toBeHidden();
    await editor(page).locator('.toggle', { hasText: 'A folded toggle' }).locator('.toggle-arrow').first().click();
    await expect(editor(page).getByText('Hidden inside it.')).toBeVisible();
    await expect(page.locator('header')).not.toContainText('unsaved');
  });

  test('a code block keeps its height as the pointer passes', async ({ page }) => {
    await openDocument(page, 'light', 'Team handbook.md');
    const block = editor(page).locator('.code-block');
    await page.mouse.move(0, 0);
    const before = (await block.boundingBox())!.height;
    await block.hover();
    await expect(block.locator('.code-copy')).toBeVisible();
    expect((await block.boundingBox())!.height).toBe(before);
  });

  test('an equation edited in its field changes the page', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Blocks.md');
    await editor(page).locator('.math-inline').first().click();
    const field = page.getByRole('textbox', { name: 'Equation' });
    await expect(field).toBeFocused();
    await field.fill('\\pi d');
    await page.keyboard.press('Enter');
    await expect(field).toBeHidden();
    await expect(page.locator('header')).toContainText('unsaved');
  });

  test('emoji go in by name and from the picker', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await newLineAtEnd(page);
    await page.keyboard.type('Go :rocke');
    await expect(page.getByRole('listbox', { name: 'Emoji' })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(editor(page)).toContainText('Go 🚀');
    await page.keyboard.type(' /emoji');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Emoji' })).toBeVisible();
    await page.getByRole('button', { name: 'party popper' }).click();
    await expect(editor(page)).toContainText('🎉');
  });

  test('Turn into offers only its own family', async ({ page }) => {
    await openDocument(page, 'light', 'Team handbook.md');
    const openMenu = async (text: string) => {
      await editor(page).getByText(text).first().hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      await expect(menus(page)).toBeVisible();
    };
    await openMenu('Files are the source of truth');
    await expect(page.getByRole('menuitem', { name: 'Turn into' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await openMenu('Ship small');
    await page.getByRole('menuitem', { name: 'Turn into' }).click();
    await expect(page.getByRole('menuitem', { name: 'Numbered list' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Heading 1' })).toHaveCount(0);
  });

  test('a second ⌘Enter on an empty last line leaves a callout', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Blocks.md');
    await editor(page).getByText('An info callout.', { exact: false }).click();
    await page.keyboard.press('End');
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.keyboard.type('Inside');
    await expect(editor(page).locator('.callout').first()).toContainText('Inside');
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.keyboard.type('Outside');
    await expect(editor(page).locator('.callout').first()).not.toContainText('Outside');
    await expect(editor(page).locator('.callout').first().locator('xpath=following-sibling::*[1]')).toHaveText('Outside');
  });
});

test.describe('the formatting bubble', () => {
  test('Bold in the bubble bolds the selection', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await selectWord(page, 'thousand');
    await page.getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name: 'Bold' }).click();
    await expect(editor(page).locator('strong')).toHaveText('thousand');
  });

  test('a command from the bubble by keyboard gives focus back to the page', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await selectWord(page, 'thousand');
    const bubble = page.getByRole('toolbar', { name: 'Formatting' });
    await expect(bubble).toBeVisible();
    await page.keyboard.press('Alt+F10');
    await page.keyboard.press('ArrowRight');
    await expect(bubble.getByRole('button', { name: 'Bold' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(editor(page).locator('strong')).toHaveText('thousand');
    await expect(editor(page)).toBeFocused();
  });

  test('the block menu from the keyboard takes the keys, and Escape gives them back', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await selectWord(page, 'thousand');
    await page.keyboard.press('ControlOrMeta+/');
    await expect(menus(page)).toBeVisible();
    await expect(page.locator('.bava-menu:focus-within, .bava-menu:focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeFocused();
  });
});

test.describe('media', () => {
  test('a missing image, relinked to the file of its name', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Media.md');
    const missing = editor(page).locator('figure.media[data-state="missing"]');
    await missing.scrollIntoViewIfNeeded();
    await expect(missing).toContainText('logo.png is missing');
    await missing.getByRole('button', { name: 'Relink to logo.png' }).click();
    await expect(editor(page).locator('figure.media[data-state="missing"]')).toHaveCount(0);
    await expect(editor(page).locator('figure.media[data-kind="image"][data-state="ready"]')).toHaveCount(5);
  });

  test("an image's width and caption set from its menu", async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Media.md');
    const image = editor(page).locator('figure.media').first();
    const openMenu = async () => {
      await image.hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      await expect(menus(page)).toBeVisible();
    };
    await openMenu();
    await page.getByRole('menuitem', { name: 'Width' }).click();
    await page.getByRole('menuitem', { name: 'Medium' }).click();
    await expect(image).toHaveAttribute('data-width', 'medium');
    await openMenu();
    await page.getByRole('menuitem', { name: 'Caption' }).click();
    const field = page.getByRole('textbox', { name: 'Caption' });
    await expect(field).toBeFocused();
    await field.fill('Medium now');
    await page.keyboard.press('Enter');
    await expect(image.locator('figcaption')).toHaveText('Medium now');
  });

  test('full screen closes on Escape', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Media.md');
    await editor(page).locator('figure.media').nth(1).hover();
    await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
    await page.getByRole('menuitem', { name: 'Full screen' }).click();
    await expect(page.locator('.media-viewer img')).toBeVisible();
    // Not in the same instant it appeared: before the viewer listens for Escape.
    await personPace(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('.media-viewer')).toHaveCount(0);
  });

  test('a video keeps its player while the page is typed in elsewhere', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Media.md');
    const video = editor(page).locator('figure.media[data-kind="video"] video');
    await video.evaluate((element) => ((element as HTMLVideoElement & { marked?: boolean }).marked = true));
    await editor(page).getByText('Typed after the video.').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' And more.');
    await expect(editor(page)).toContainText('Typed after the video. And more.');
    expect(await video.evaluate((element) => (element as HTMLVideoElement & { marked?: boolean }).marked)).toBe(true);
  });
});

test.describe('tables', () => {
  test('a merged cell splits back into its cells', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Tables.md');
    const table = editor(page).locator('table').first();
    await dragCells(page, 'Ana', 'Build');
    await rightClick(page, 'Build');
    await page.getByRole('menuitem', { name: 'Merge cells' }).click();
    const merged = table.locator('[colspan="2"][rowspan="2"]');
    await expect(merged).toHaveCount(1);
    await rightClick(page, merged);
    await expect(page.getByRole('menuitem', { name: 'Split cell' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Merge cells' })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Split cell' }).click();
    await expect(table.locator('[colspan="2"]')).toHaveCount(0);
    await expect(table.locator('tr').nth(1).locator('td')).toHaveCount(3);
  });

  test('merging a header with body cells is not offered', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Tables.md');
    await dragCells(page, 'Name', 'Ana');
    await expect(editor(page).locator('.selectedCell')).toHaveCount(2);
    await rightClick(page, 'Ana');
    await expect(page.getByRole('menuitem', { name: 'Insert row above' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Merge cells' })).toHaveCount(0);
  });

  test('the header row cannot move up, only down', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Tables.md');
    await rightClick(page, 'Name');
    await expect(page.getByRole('menuitem', { name: 'Move row down' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Move row up' })).toHaveCount(0);
  });

  test('resizing a column and adding a row', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Tables.md');
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

  test('typing on the empty line after a table keeps another after it', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Tables.md');
    const last = editor(page).locator('p').last();
    await expect(last).toHaveText('');
    await last.click();
    await page.keyboard.type('After the table');
    await expect(editor(page).locator('p').last()).toHaveText('');
    await expect(editor(page).getByText('After the table')).toBeVisible();
  });

  test('⌘Enter adds a block after a table, and ⇧⌘Enter before it', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Tables.md');
    const blocks = editor(page).locator(':scope > *');
    const count = await blocks.count();
    await caretInCell(page, 'Ana');
    await page.keyboard.press('ControlOrMeta+Enter');
    await page.keyboard.type('Between the tables');
    await expect(blocks).toHaveCount(count + 1);
    await expect(editor(page).locator('.tableWrapper').first().locator('xpath=following-sibling::*[1]')).toHaveText('Between the tables');
    await caretInCell(page, 'Ana');
    await page.keyboard.press('ControlOrMeta+Shift+Enter');
    await page.keyboard.type('Before the table');
    await expect(editor(page).locator('.tableWrapper').first().locator('xpath=preceding-sibling::*[1]')).toHaveText('Before the table');
  });
});

test.describe('links', () => {
  test('a page chosen from the @ menu is linked', async ({ page }) => {
    await openDocument(page, 'light', 'Roadmap.md');
    await newLineAtEnd(page);
    await page.keyboard.type('See @launch');
    const list = page.getByRole('listbox', { name: 'Dates and pages' });
    await expect(list.getByRole('option')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await expect(editor(page).locator('a[href="Marketing/Launch%20plan.md"]')).toHaveText('Launch plan');
  });

  test('a day chosen in the calendar changes the date chip', async ({ page }) => {
    await openDocument(page, 'light', 'Roadmap.md');
    await editor(page).locator('time.date-chip').first().click();
    const calendar = page.getByRole('dialog', { name: 'Calendar' });
    await expect(calendar.locator('.month')).toHaveText('October 2026');
    await calendar.locator('.day:not([data-outside-range])', { hasText: /^15$/ }).click();
    await expect(calendar).toBeHidden();
    await expect(editor(page).locator('time.date-chip').first()).toHaveText('15 Oct 2026');
  });

  test("Remove on a link's card keeps the words", async ({ page }) => {
    await openDocument(page, 'light', 'Roadmap.md');
    await editor(page).getByText('Brief', { exact: true }).click();
    const card = page.getByRole('dialog', { name: 'Link' });
    await card.getByRole('button', { name: 'Remove' }).click();
    await expect(editor(page).locator('a', { hasText: 'Brief' })).toHaveCount(0);
    await expect(editor(page)).toContainText('The Brief was never written.');
  });

  test('Linked from goes back, and ⌘-click on a link to a heading lands on it', async ({ page }) => {
    await openDocument(page, 'light', 'Roadmap.md');
    await editor(page).getByText('Brand guide', { exact: true }).click();
    await page.getByRole('dialog', { name: 'Link' }).getByRole('button', { name: 'Open' }).click();
    await expect(page.locator('header')).toContainText('Brand guide');
    await page.getByRole('navigation', { name: 'Linked from' }).getByRole('button', { name: 'Roadmap' }).click();
    await expect(page.locator('header')).toContainText('Roadmap');
    await editor(page).getByText('Lists', { exact: true }).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('header')).toContainText('Team handbook');
    // The heading at the top of the view: where it lands is the check.
    const heading = editor(page).locator('h2', { hasText: 'Lists' });
    const top = await documentPane(page).locator('.scroller').evaluate((el) => el.getBoundingClientRect().top);
    await expect.poll(async () => Math.round((await heading.boundingBox())!.y - top)).toBeLessThan(40);
  });

  test('renaming a linked page in the tree: the open page follows', async ({ page }) => {
    await openDocument(page, 'light', 'Roadmap.md');
    await page.locator('[data-path="Marketing"]').click();
    await page.locator('[data-path="Marketing/Brand guide.md"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const field = page.locator('input.rename').filter({ visible: true });
    await field.fill('Brand book');
    await field.press('Enter');
    await expect(editor(page).locator('a[href="Marketing/Brand%20book.md"]')).toHaveText('Brand book');
    await expect(page.locator('header')).toContainText('Roadmap');
    // A page that is not open follows too: its file is rewritten.
    await menu(page, 'file.save');
    await page.locator('[data-path="Marketing/Brand book.md"]').click();
    await expect(page.locator('header')).toContainText('Brand book');
    await page.locator('[data-path="Team handbook.md"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const again = page.locator('input.rename').filter({ visible: true });
    await again.fill('Handbook');
    await again.press('Enter');
    await expect(page.locator('[data-path="Handbook.md"]')).toBeVisible();
    await page.locator('[data-path="Roadmap.md"]').click();
    await expect(editor(page).locator('a[href="Handbook.md#lists"]')).toHaveText('Lists');
  });
});

// The page's menus, fields and typing as a person uses them: what each opens
// with and offers, and what it leaves on the page.
test.describe('the page as it is typed and pointed at', () => {
  // The shortcuts, typed as a person types them, in a real browser.
  test('typing shortcuts make blocks', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
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
  });

  test('the / menu', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await newLineAtEnd(page);
    await page.keyboard.type('/');
    await restPointer(page);
    await expect(page.locator('.slash-group')).toHaveText(['Basic', 'Advanced', 'Inline']);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(1);
    await expect(menus(page).locator('[role="option"]').first()).toHaveAttribute('data-highlighted', '');
    await page.keyboard.type('head');
    await expect(page.locator('.slash-group')).toHaveText(['Basic']);
    await expect(menus(page).locator('[role="option"]').first()).toHaveAttribute('data-highlighted', '');
  });

  test('the bubble from the keyboard', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await selectWord(page, 'thousand');
    const bubble = page.getByRole('toolbar', { name: 'Formatting' });
    // Alt+F10 goes into the bubble a person can see.
    await expect(bubble).toBeVisible();
    await page.keyboard.press('Alt+F10');
    await expect(bubble.getByRole('button').first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await restPointer(page);
    await expect(bubble.getByRole('button', { name: 'Bold' })).toBeFocused();
  });

  test("a code block's language menu lists plain text and each language", async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Blocks.md');
    const block = editor(page).locator('.code-block');
    await block.hover();
    await editor(page).locator('.code-language').click();
    await expect(menus(page)).toHaveCount(1);
    await expect(menus(page).getByRole('menuitem', { name: 'Plain text' })).toBeVisible();
    for (const language of ['Python', 'Go', 'Rust', 'JSON']) await expect(menus(page).getByRole('menuitem', { name: language, exact: true })).toBeVisible();
  });

  test('editing an equation', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Blocks.md');
    const equation = editor(page).locator('.math-inline').first();
    await equation.click();
    await restPointer(page);
    await expect(page.getByRole('textbox', { name: 'Equation' })).toBeFocused();
    await expect(page.locator('.equation-preview .katex')).toBeVisible();
  });

  test('emoji by name', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await newLineAtEnd(page);
    await page.keyboard.type('Go :rocke');
    await restPointer(page);
    const list = page.getByRole('listbox', { name: 'Emoji' });
    await expect(list).toBeVisible();
    await expect(list.locator('[role="option"]').first()).toHaveAttribute('data-highlighted', '');
  });

  test('/emoji opens the emoji picker under the line it was typed on', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await newLineAtEnd(page);
    await page.keyboard.type('/emoji');
    await page.keyboard.press('Enter');
    const picker = page.getByRole('dialog', { name: 'Emoji' });
    await expect(picker).toBeVisible();
    // The line it opened from is left empty, showing its placeholder.
    const line = (await editor(page).locator('p.is-empty[data-placeholder]').boundingBox())!;
    const box = (await picker.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(line.y + line.height - 1);
  });

  test("an image's menu, open at Width", async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Media.md');
    await expect(editor(page).locator('figure.media[data-kind="image"][data-state="ready"]')).toHaveCount(4);
    const image = editor(page).locator('figure.media').first();
    await image.hover();
    await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
    await page.getByRole('menuitem', { name: 'Width' }).click();
    await expect(page.getByRole('menuitem', { name: 'Full width' })).toBeVisible();
    // The pointer stays on Width: moved off, Ark closes the submenu it opened.
    await expect(menus(page)).toHaveCount(2);
    await expect(page.getByRole('menuitem', { name: 'Width', exact: true })).toHaveAttribute('data-highlighted', '');
  });

  test("a video's menu", async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Media.md');
    const video = editor(page).locator('figure.media').nth(4);
    await centreInView(video);
    await video.hover();
    await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Loop' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Turn into' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Full screen' })).toHaveCount(0);
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
  });

  test("a web card's menu, open at Show as", async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Media.md');
    const card = editor(page).locator('.card').nth(3);
    await centreInView(card);
    await card.hover();
    await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
    await page.getByRole('menuitem', { name: 'Show as' }).click();
    await expect(page.getByRole('menuitem', { name: 'Extended card' })).toBeVisible();
    // The pointer stays on Show as: moved off, Ark closes the submenu it opened.
    await expect(menus(page)).toHaveCount(2);
    await expect(page.getByRole('menuitem', { name: 'Show as' })).toHaveAttribute('data-highlighted', '');
  });

  test('a row moved, and the header row switched off', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Tables.md');
    const table = editor(page).locator('table').first();
    await rightClick(page, 'Ben');
    await page.getByRole('menuitem', { name: 'Move row up' }).click();
    await expect(table.locator('tr').nth(1)).toContainText('Ben');
    await rightClick(page, 'Ben');
    await page.getByRole('menuitem', { name: 'Remove header row' }).click();
    await expect(table.locator('th')).toHaveCount(0);
    // Held as a person holds it: a press and release in the same instant can
    // leave the cell selection in place.
    await expect(menus(page)).toHaveCount(0);
    await editor(page).locator('h1').click({ delay: 50 });
    await expect(table.locator('.selectedCell')).toHaveCount(0);
  });

  test('a new table: no hint in its cells, and a / menu of what goes in a line', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await newLineAtEnd(page);
    await page.keyboard.type('/table');
    await page.keyboard.press('Enter');
    await expect(editor(page).locator('table th')).toHaveCount(3);
    await expect(editor(page).locator('table .is-empty')).toHaveCount(0);
    await page.keyboard.type('/');
    await restPointer(page);
    await expect(page.locator('.slash-group')).toHaveText(['Inline']);
  });

  test('spreadsheet rows pasted as a table', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    await newLineAtEnd(page);
    await editor(page).evaluate((el) => {
      const data = new DataTransfer();
      data.setData('text/plain', 'Task\tOwner\nWrite\tAna\nShip\tBen');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    await restPointer(page);
    await expect(editor(page).locator('table td')).toHaveCount(4);
  });

  test('a page ending in a table keeps an empty line after it, which takes the caret', async ({ page }) => {
    await openDocument(page, 'light', 'Engineering/Tables.md');
    const last = editor(page).locator(':scope > :last-child');
    await expect(last).toHaveText('');
    expect(await last.evaluate((element) => [element.tagName, element.previousElementSibling?.querySelector('table') !== null || element.previousElementSibling?.tagName === 'TABLE'])).toEqual(['P', true]);
    await last.click();
    expect(await last.evaluate((element) => element.contains(getSelection()?.anchorNode ?? null))).toBe(true);
  });

  test('the @ menu: dates, then pages', async ({ page }) => {
    await openDocument(page, 'light', 'Roadmap.md');
    await newLineAtEnd(page);
    await page.keyboard.type('See @');
    await restPointer(page);
    const list = page.getByRole('listbox', { name: 'Dates and pages' });
    await expect(list.getByRole('option').first()).toContainText('Today');
    await expect(list.getByRole('option').first()).toHaveAttribute('data-highlighted', '');
    await expect(list.getByRole('option', { name: /Launch plan/ })).toBeVisible();
  });

  test('a date chip and its calendar', async ({ page }) => {
    await openDocument(page, 'light', 'Roadmap.md');
    const chip = editor(page).locator('time.date-chip').first();
    await expect(editor(page).locator('time.date-chip')).toHaveText(['2 Oct 2026', 'next Friday']);
    await chip.click();
    await restPointer(page);
    const calendar = page.getByRole('dialog', { name: 'Calendar' });
    await expect(calendar.locator('.month')).toHaveText('October 2026');
    // The chip's own day is the one chosen, and has the focus.
    await expect(calendar.locator('.day[data-selected]')).toHaveText('2');
    await expect(calendar.locator('.day[data-selected]')).toBeFocused();
  });

  test('a link card, and a link to a missing page', async ({ page }) => {
    await openDocument(page, 'light', 'Roadmap.md');
    const brand = editor(page).getByText('Brand guide', { exact: true });
    await brand.click();
    await restPointer(page);
    const card = page.getByRole('dialog', { name: 'Link' });
    await expect(card.locator('.address')).toHaveText('Marketing/Brand guide.md');
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();
    const brief = editor(page).getByText('Brief', { exact: true });
    await expect(editor(page).locator('.link-missing')).toHaveText('Brief');
    await brief.click();
    await restPointer(page);
    await expect(card.locator('.missing')).toHaveText('Page not found');
    await expect(card.getByRole('button', { name: 'Open' })).toHaveCount(0);
  });

  test('the page menu', async ({ page }) => {
    await openDocument(page, 'light', 'Marketing/Launch plan.md');
    const button = page.getByRole('button', { name: 'Page menu' });
    await button.click();
    await expect(menus(page)).toHaveCount(1);
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
  });
});

test.describe('how the page is laid out', () => {
  test('a to-do box sits level with its line, and a paragraph after a heading is set apart', async ({ page }) => {
    await openDocument(page, 'light', 'Team handbook.md');
    await expect(editor(page).locator('li[data-checked="true"]')).toHaveCount(1);
    const item = editor(page).locator('li[data-checked="false"]');
    const box = (await item.locator('.todo-box').boundingBox())!;
    const line = (await item.locator('p').boundingBox())!;
    expect(Math.abs(box.y + box.height / 2 - (line.y + Math.min(line.height, 24) / 2))).toBeLessThan(2);
    const title = (await editor(page).locator('h1').boundingBox())!;
    const intro = (await editor(page).locator('p').first().boundingBox())!;
    expect(intro.y - (title.y + title.height)).toBeGreaterThanOrEqual(8);
  });
});

// A field opened from a block's menu takes the keys, and the menu closes as
// it opens rather than staying in the page.
test.describe("fields opened from a block's menu", () => {
  for (const [name, item] of [
    ['image', 'Caption'],
    ['file-card', 'Rename file'],
  ] as const) {
    test(`${item} on ${name === 'image' ? 'an image' : 'a file card'} opens its field focused, and the menu closes`, async ({ page }) => {
      const subject = SUBJECTS[name];
      await openSeeded(page, 'light', subject.markdown);
      const block = editor(page).locator(subject.find).first();
      await expect(block).toBeVisible();
      await imagesLoaded(editor(page));
      await block.hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      await page.getByRole('menuitem', { name: item }).click();
      await expect(page.locator('.link-field').getByRole('textbox')).toBeFocused();
      await expect(menus(page)).toHaveCount(0);
    });
  }
});
