import { expect, test } from '@playwright/test';
import {
  caretInCell,
  documentPane,
  dragCells,
  editor,
  menu,
  menus,
  newLineAtEnd,
  openDocument,
  personPace,
  rightClick,
  selectWord,
} from './helpers';

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
