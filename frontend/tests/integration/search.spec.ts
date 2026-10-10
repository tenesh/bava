import { expect, test, type Page } from '@playwright/test';
import { canvasPane, editor, menu, openApp, openLoosePage, openPage, openSpace, selectionToolbar, sidePane } from '../helpers';

// Search across a Space (File ▸ Search, ⇧⌘F), and find on the Canvas (⌘F),
// as a person uses them: typing, choosing a result, landing at its match.

const palette = (page: Page) => page.getByRole('dialog', { name: 'Search' });
const field = (page: Page) => palette(page).getByRole('searchbox', { name: 'Search' });
const results = (page: Page) => palette(page).getByRole('option');

async function searchFor(page: Page, query: string) {
  await menu(page, 'file.search');
  await expect(field(page)).toBeFocused();
  await field(page).fill(query);
}

test.describe('search across a Space', () => {
  test('opens focused, with only a hint, and closes with Escape', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'file.search');
    await expect(field(page)).toBeFocused();
    await expect(palette(page)).toContainText('Search pages, folders and canvases');
    await expect(results(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(palette(page)).toHaveCount(0);
  });

  test('lists pages by name first, then by what they hold', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await searchFor(page, 'launch');
    await expect(results(page).first()).toContainText('Launch plan');
    await expect(results(page).first()).toHaveAttribute('aria-selected', 'true');
  });

  test('a match in a page opens it with the find bar on the word', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await searchFor(page, 'bold');
    await expect(results(page).first()).toContainText('Team handbook');
    await page.keyboard.press('Enter');
    await expect(palette(page)).toHaveCount(0);
    const find = page.getByRole('search', { name: 'Find in page' });
    await expect(find.getByRole('searchbox', { name: 'Find' })).toHaveValue('bold');
    await expect(find).toContainText('1 of');
    await expect(editor(page).locator('.ProseMirror-active-search-match')).toHaveText(/bold/i);
  });

  test('a match on a canvas opens the Canvas with the element chosen and find filled', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await searchFor(page, 'stamp');
    await expect(results(page).first()).toContainText('Architecture');
    await expect(results(page).first()).toContainText('On the canvas: Stamp check');
    await page.keyboard.press('Enter');
    const find = canvasPane(page).getByRole('search', { name: 'Find on canvas' });
    await expect(find.getByRole('searchbox', { name: 'Find' })).toHaveValue('stamp');
    await expect(find).toContainText('1 of 1');
    await expect(selectionToolbar(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(find).toHaveCount(0);
  });

  test('a folder found is shown in the Files tree', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await searchFor(page, 'engineering');
    await expect(results(page).first()).toContainText('Engineering');
    await page.keyboard.press('Enter');
    const row = sidePane(page).locator('[data-path="Engineering"]');
    await expect(row).toBeFocused();
    await expect(sidePane(page).locator('[data-path="Engineering/Architecture.md"]')).toBeVisible();
  });

  test('Escape gives the keys back to where they were', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Team handbook.md');
    await editor(page).click();
    await menu(page, 'file.search');
    await expect(field(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('.bava-doc')))).toBe(true);
  });

  test('a folder found leaves the open page chosen in the tree', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Team handbook.md');
    await searchFor(page, 'engineering');
    await expect(results(page).first()).toContainText('Engineering');
    await page.keyboard.press('Enter');
    await expect(sidePane(page).locator('[data-path="Engineering"]')).toBeFocused();
    await expect(sidePane(page).locator('[data-path="Team handbook.md"]')).toHaveAttribute('data-selected', '');
  });

  test('says when nothing matched', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await searchFor(page, 'zzzz');
    await expect(palette(page)).toContainText('No results');
  });

  test('a page on its own asks to open its folder as a Space first', async ({ page }) => {
    await openApp(page, 'light');
    await openLoosePage(page);
    await menu(page, 'file.search');
    const ask = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: 'Open this folder as a Space?' }));
    await expect(ask).toContainText('Search looks through a Space');
  });
});

test.describe('find on the Canvas', () => {
  test('in Both, ⌘F finds in the page while the page has the keys, on the Canvas otherwise', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Engineering/Architecture.md');
    await menu(page, 'view.both');
    await editor(page).click();
    await menu(page, 'edit.find');
    await expect(page.getByRole('search', { name: 'Find in page' })).toBeVisible();
    await page.keyboard.press('Escape');
    await canvasPane(page).click();
    await menu(page, 'edit.find');
    await expect(canvasPane(page).getByRole('search', { name: 'Find on canvas' })).toBeVisible();
  });


  test('⌘F with the Canvas showing finds there and steps through the matches', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Engineering/Architecture.md');
    await menu(page, 'view.canvas');
    await menu(page, 'edit.find');
    const find = canvasPane(page).getByRole('search', { name: 'Find on canvas' });
    const box = find.getByRole('searchbox', { name: 'Find' });
    await expect(box).toBeFocused();
    await box.fill('e');
    await expect(find).toContainText('1 of');
    await page.keyboard.press('Enter');
    await expect(find).toContainText('2 of');
    await expect(find.getByRole('textbox', { name: 'Replace with' })).toHaveCount(0);
  });
});
