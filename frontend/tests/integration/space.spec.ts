import { expect, test, type Page } from '@playwright/test';
import { SPACE, menu, menus, openApp, openSpace, restPointer, rightClick, sidePane, statusMessage } from '../helpers';

const RECENTS = [
  { path: '/Users/you/Documents/Acme Product', kind: 'space', openedAt: Date.UTC(2026, 8, 26) },
  { path: '/Users/you/Documents/Thesis', kind: 'space', openedAt: Date.UTC(2026, 8, 20) },
];

// The side pane as a person works in it: what its menus offer, the switcher,
// naming and renaming, searching Media, a page dropped into a folder, and a
// folder folded.

test.describe('the side pane at work', () => {
  test('the Add menu', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    const add = page.getByRole('button', { name: 'Add to Files' });
    await add.click();
    await expect(menus(page)).toHaveCount(1);
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
  });

  test('naming a new page', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'file.new');
    await expect(page.locator('input.rename').filter({ visible: true })).toBeFocused();
  });

  test('the Space switcher', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    const switcher = page.locator('.bava-space-switcher');
    await switcher.click();
    await expect(menus(page)).toHaveCount(1);
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
  });

  test('the right-click menu below the rows', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    // The tree's own room under its last row.
    const box = (await sidePane(page).locator('.space-tree .tree').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 4, { button: 'right' });
    await expect(menus(page)).toHaveCount(1);
    await expect(menus(page).getByRole('menuitem')).toHaveText(['New page', 'New folder']);
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
    await expect(sidePane(page).locator('[data-menu]')).toHaveCount(0);
  });

  test('renaming a page, and a name another page has', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await rightClick(page, page.locator('[data-path="Roadmap.md"]'));
    await menus(page).getByRole('menuitem', { name: 'Rename' }).click();
    const field = page.locator('input.rename').filter({ visible: true });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('Roadmap');
    await restPointer(page);
    await field.fill('Team handbook');
    await field.press('Enter');
    await expect(statusMessage(page)).toHaveText('Something with that name is already there.');
    await expect(page.locator('[data-path="Roadmap.md"]')).toBeVisible();
  });

  test('the Space switcher with recent Spaces', async ({ page }) => {
    await openApp(page, 'light', { 'bava.recents': JSON.stringify(RECENTS) });
    await openSpace(page);
    const switcher = page.locator('.bava-space-switcher');
    await switcher.click();
    await expect(menus(page).getByRole('menuitem', { name: /Thesis/ })).toBeVisible();
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
  });

  for (const [what, path] of [
    ['page', 'Roadmap.md'],
    ['folder', 'Marketing'],
  ] as const) {
    test(`the right-click menu on a ${what}`, async ({ page }) => {
      await openApp(page, 'light');
      await openSpace(page);
      const row = page.locator(`[data-path="${path}"]`);
      await rightClick(page, row);
      await expect(menus(page)).toHaveCount(1);
      await expect(menus(page).getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      // The row the menu is for stays marked while it is open.
      await expect(row).toHaveAttribute('data-menu', '');
    });
  }

  test('a folder opens and folds on a click', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    const folder = page.locator('[data-path="Engineering"]');
    const inside = page.locator('[data-path="Engineering/Architecture.md"]');
    await folder.click();
    await expect(inside).toBeVisible();
    await folder.click();
    await expect(inside).toBeHidden();
  });
});

// Tags across the Space: the tree narrowed to chosen tags, and a tag
// renamed, merged or deleted in every page's file.
test.describe('tags', () => {
  type SourceHarness = { __bava: { fakes: { harness: { source(root: string, path: string): string | undefined } } } };
  const source = (page: Page, path: string) => page.evaluate(([root, at]) => (window as unknown as SourceHarness).__bava.fakes.harness.source(root, at), [SPACE, path] as const);
  const tagButton = (page: Page) => page.getByRole('button', { name: 'Filter by tag' });
  const tagList = (page: Page) => page.getByRole('dialog', { name: 'Filter by tag' });

  test('choosing two tags narrows the tree to the pages that have both', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await tagButton(page).click();
    await expect(tagList(page).getByRole('option')).toHaveText([/design\s*1/, /launch\s*2/, /q4\s*1/, /road-map\s*1/]);
    await tagList(page).getByRole('option', { name: /launch/ }).click();
    await tagList(page).getByRole('option', { name: /q4/ }).click();
    await page.keyboard.press('Escape');
    await expect(tagList(page)).toHaveCount(0);
    // Ark marks its own nodes with index paths ("0"); the rows carry the Space's.
    const paths = () => sidePane(page).evaluate((pane) => [...new Set([...pane.querySelectorAll('[role="tree"] [data-path]')].map((row) => row.getAttribute('data-path')))].filter((path) => !/^[\d/]+$/.test(path ?? '')));
    await expect.poll(paths).toEqual(['Marketing', 'Marketing/Launch plan.md']);
    await sidePane(page).getByRole('button', { name: 'Clear' }).click();
    await expect(sidePane(page).locator('[data-path="Roadmap.md"]')).toBeVisible();
  });

  test('renaming a tag from its menu rewrites every page that has it', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await tagButton(page).click();
    await tagList(page).getByRole('option', { name: /launch/ }).hover();
    await tagList(page).getByRole('button', { name: 'More for launch' }).click();
    await page.getByRole('menuitem', { name: 'Rename…' }).click();
    const field = page.getByRole('textbox', { name: 'New name for launch' });
    await expect(field).toBeFocused();
    await field.fill('Release');
    await page.keyboard.press('Enter');
    await expect.poll(() => source(page, 'Roadmap.md')).toContain('tags: [release, road-map]');
    expect(await source(page, 'Marketing/Launch plan.md')).toContain('tags: [release, q4, design]');
  });

  test('the Tags dialog merges several into one, and deletes, asking first', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await page.locator('.bava-space-switcher').click();
    await page.getByRole('menuitem', { name: 'Tags' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tags' });
    await dialog.getByRole('checkbox', { name: 'Select launch' }).check();
    await dialog.getByRole('checkbox', { name: 'Select road-map' }).check();
    await dialog.getByRole('button', { name: 'Merge into…' }).click();
    await page.getByRole('menuitem', { name: 'q4' }).click();
    const ask = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: /Merge/ }));
    await expect(ask).toContainText('Merge launch, road-map into q4?');
    await ask.getByRole('button', { name: 'Merge' }).click();
    await expect.poll(() => source(page, 'Roadmap.md')).toContain('tags: [q4]');
    expect(await source(page, 'Marketing/Launch plan.md')).toContain('tags: [q4, design]');

    await dialog.getByRole('checkbox', { name: 'Select design' }).check();
    await dialog.getByRole('button', { name: 'Delete 1 tag' }).click();
    const sure = page.getByRole('alertdialog').or(page.getByRole('dialog', { name: /Delete/ }));
    await expect(sure).toContainText('It comes off 1 page.');
    await sure.getByRole('button', { name: 'Delete' }).click();
    await expect.poll(() => source(page, 'Marketing/Launch plan.md')).toContain('tags: [q4]\n');
    // The page's own words are untouched.
    expect(await source(page, 'Marketing/Launch plan.md')).toContain('# Launch plan\n\nHow we take Bava 1.0');
  });
});
