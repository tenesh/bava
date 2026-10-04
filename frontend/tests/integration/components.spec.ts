import { expect, test, type Locator, type Page } from '@playwright/test';
import { clickAway, editor, menu, menus, newLineAtEnd, openApp, openDialog, openDocument, openPage, openSpace, personPace, popovers, selectWord } from '../helpers';

// Anything that floats over the app (a menu, a picker, a field, a card, a
// dialog) closes when the pointer goes down anywhere else: on the page's own
// text, or outside the page altogether.

type Opener = { name: string; path: string; open: (page: Page) => Promise<Locator> };

const openers: Opener[] = [
  {
    name: 'the / menu',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await newLineAtEnd(page);
      await page.keyboard.type('/');
      return menus(page);
    },
  },
  {
    name: 'the @ menu',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await newLineAtEnd(page);
      await page.keyboard.type('@');
      return menus(page);
    },
  },
  {
    name: 'emoji by name',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await newLineAtEnd(page);
      await page.keyboard.type(':smi');
      return menus(page);
    },
  },
  {
    name: 'the emoji picker',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await newLineAtEnd(page);
      await page.keyboard.type('/emoji');
      await page.keyboard.press('Enter');
      return page.locator('.emoji-picker');
    },
  },
  {
    name: 'the link field',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await selectWord(page, 'thousand');
      await page.keyboard.press('ControlOrMeta+k');
      return page.locator('.link-field');
    },
  },
  {
    name: "a link's card",
    path: 'Roadmap.md',
    open: async (page) => {
      await editor(page).getByText('Brand guide').click();
      return page.locator('.link-card');
    },
  },
  {
    name: 'the calendar',
    path: 'Roadmap.md',
    open: async (page) => {
      await editor(page).locator('time.date-chip').first().click();
      return page.locator('.date-picker');
    },
  },
  {
    name: 'the equation field',
    path: 'Engineering/Blocks.md',
    open: async (page) => {
      await editor(page).locator('.math-inline').first().click();
      return page.locator('.equation-field');
    },
  },
  {
    name: "a code block's languages",
    path: 'Engineering/Blocks.md',
    open: async (page) => {
      await editor(page).locator('.code-language').click();
      return menus(page);
    },
  },
  {
    name: 'the block menu',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await editor(page).locator('p').first().hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      return menus(page);
    },
  },
  {
    name: 'the page menu',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await page.getByRole('button', { name: 'Page menu' }).click();
      return menus(page);
    },
  },
  {
    name: "a medium's caption field",
    path: 'Engineering/Media.md',
    open: async (page) => {
      await editor(page).locator('figure.media').first().hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      await page.getByRole('menuitem', { name: 'Caption' }).click();
      return page.locator('.link-field');
    },
  },
  {
    name: 'the formatting bubble',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await selectWord(page, 'thousand');
      return page.getByRole('toolbar', { name: 'Formatting' });
    },
  },
];

for (const opener of openers) {
  for (const where of ['page', 'outside'] as const) {
    test(`${opener.name} closes on a click ${where === 'page' ? 'in the page' : 'outside the page'}`, async ({ page }) => {
      await openDocument(page, 'light', opener.path);
      const floating = await opener.open(page);
      await expect(floating.first()).toBeVisible();
      await clickAway(page, where);
      await expect(floating).toHaveCount(0);
    });
  }
}

// Across the app: the Space's menus, and every dialog by a click on what is
// behind it.
test('the Space switcher closes on a click elsewhere', async ({ page }) => {
  await openApp(page, 'light');
  await openSpace(page);
  await page.locator('.bava-space-switcher').click();
  await expect(menus(page)).toBeVisible();
  await clickAway(page, 'outside');
  await expect(menus(page)).toHaveCount(0);
});

test("the Files tree's Add menu closes on a click elsewhere", async ({ page }) => {
  await openApp(page, 'light');
  await openSpace(page);
  await page.locator('.files-button').click();
  await expect(menus(page)).toBeVisible();
  await clickAway(page, 'outside');
  await expect(menus(page)).toHaveCount(0);
});

for (const [name, command] of [
  ['the Trash', 'space.trash'],
  ['Space settings', 'file.spaceSettings'],
  ['Keyboard shortcuts', 'help.shortcuts'],
  ['About', 'help.about'],
] as const) {
  test(`${name} closes on a click beside it`, async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, command);
    await expect(openDialog(page)).toBeVisible();
    await personPace(page);
    await page.mouse.click(8, 400);
    await expect(openDialog(page)).toHaveCount(0);
  });
}

test('Media closes on a click beside it', async ({ page }) => {
  await openApp(page, 'light');
  await openSpace(page);
  await page.getByRole('button', { name: 'Open Media' }).click();
  await expect(openDialog(page)).toBeVisible();
  await personPace(page);
  await page.mouse.click(8, 400);
  await expect(openDialog(page)).toHaveCount(0);
});

test("the canvas's pickers close on a click elsewhere", async ({ page }) => {
  await openApp(page, 'light');
  await openPage(page, 'Engineering/Architecture.md');
  await menu(page, 'view.canvas');
  await menu(page, 'edit.selectAll');
  const trigger = page.locator('.bava-control-trigger').first();
  await trigger.click();
  await expect(popovers(page)).toBeVisible();
  await clickAway(page, 'outside');
  await expect(popovers(page)).toHaveCount(0);
});
