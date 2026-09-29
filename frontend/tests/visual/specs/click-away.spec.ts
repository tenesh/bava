import { expect, test, type Locator, type Page } from '@playwright/test';
import { menu, openApp, openDialog, openPage, openSpace } from './helpers';

// Anything that floats over the app (a menu, a picker, a field, a card, a
// dialog) closes when the pointer goes down anywhere else: on the page's own
// text, or outside the page altogether.

const editor = (page: Page) => page.locator('.bava-doc');
const menus = (page: Page) => page.locator('.bava-menu').filter({ visible: true });

async function openDocument(page: Page, folder: string, path: string) {
  await openApp(page, 'light');
  await openPage(page, folder, path);
  await menu(page, 'view.document');
  await expect(editor(page)).toBeVisible();
}

/** The empty line the page always ends with, the caret on it. */
async function newLineAtEnd(page: Page) {
  const last = editor(page).locator('p').last();
  await last.click();
  await expect(async () => {
    expect(await last.evaluate((p) => p.contains(document.getSelection()!.anchorNode))).toBe(true);
  }).toPass();
}

/** A click somewhere else: on the page's title, or on the status bar, outside the page. */
async function clickAway(page: Page, where: 'page' | 'outside') {
  // As a person clicks: not in the same instant the thing appeared, before
  // Ark's pieces listen for a click outside them.
  await page.waitForTimeout(250);
  const target = where === 'page' ? editor(page).locator('h1').first() : page.locator('footer').first();
  const box = (await target.boundingBox())!;
  await page.mouse.click(box.x + Math.min(40, box.width / 2), box.y + box.height / 2);
}

type Opener = { name: string; folder: string; path: string; open: (page: Page) => Promise<Locator> };

const openers: Opener[] = [
  {
    name: 'the / menu',
    folder: 'Marketing',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await newLineAtEnd(page);
      await page.keyboard.type('/');
      return menus(page);
    },
  },
  {
    name: 'the @ menu',
    folder: 'Marketing',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await newLineAtEnd(page);
      await page.keyboard.type('@');
      return menus(page);
    },
  },
  {
    name: 'emoji by name',
    folder: 'Marketing',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await newLineAtEnd(page);
      await page.keyboard.type(':smi');
      return menus(page);
    },
  },
  {
    name: 'the emoji picker',
    folder: 'Marketing',
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
    folder: 'Marketing',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await editor(page).getByText('thousand').dblclick();
      await page.keyboard.press('ControlOrMeta+k');
      return page.locator('.link-field');
    },
  },
  {
    name: "a link's card",
    folder: '',
    path: 'Roadmap.md',
    open: async (page) => {
      await editor(page).getByText('Brand guide').click();
      return page.locator('.link-card');
    },
  },
  {
    name: 'the calendar',
    folder: '',
    path: 'Roadmap.md',
    open: async (page) => {
      await editor(page).locator('time.date-chip').first().click();
      return page.locator('.date-picker');
    },
  },
  {
    name: 'the equation field',
    folder: 'Engineering',
    path: 'Engineering/Blocks.md',
    open: async (page) => {
      await editor(page).locator('.math-inline').first().click();
      return page.locator('.equation-field');
    },
  },
  {
    name: "a code block's languages",
    folder: 'Engineering',
    path: 'Engineering/Blocks.md',
    open: async (page) => {
      await editor(page).locator('.code-language').click();
      return menus(page);
    },
  },
  {
    name: 'the block menu',
    folder: 'Marketing',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await editor(page).locator('p').first().hover();
      await page.getByRole('button', { name: 'Drag, or open the block menu' }).click();
      return menus(page);
    },
  },
  {
    name: 'the page menu',
    folder: 'Marketing',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await page.getByRole('button', { name: 'Page menu' }).click();
      return menus(page);
    },
  },
  {
    name: "a medium's caption field",
    folder: 'Engineering',
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
    folder: 'Marketing',
    path: 'Marketing/Launch plan.md',
    open: async (page) => {
      await editor(page).getByText('thousand').dblclick();
      return page.getByRole('toolbar', { name: 'Formatting' });
    },
  },
];

for (const opener of openers) {
  for (const where of ['page', 'outside'] as const) {
    test(`${opener.name} closes on a click ${where === 'page' ? 'in the page' : 'outside the page'}`, async ({ page }) => {
      await openDocument(page, opener.folder, opener.path);
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
    await page.waitForTimeout(250);
    await page.mouse.click(8, 400);
    await expect(openDialog(page)).toHaveCount(0);
  });
}

test('Media closes on a click beside it', async ({ page }) => {
  await openApp(page, 'light');
  await openSpace(page);
  await page.getByRole('button', { name: 'Open Media' }).click();
  await expect(openDialog(page)).toBeVisible();
  await page.waitForTimeout(250);
  await page.mouse.click(8, 400);
  await expect(openDialog(page)).toHaveCount(0);
});

test("the canvas's pickers close on a click elsewhere", async ({ page }) => {
  await openApp(page, 'light');
  await openPage(page, 'Engineering', 'Engineering/Architecture.md');
  await menu(page, 'view.canvas');
  await menu(page, 'edit.selectAll');
  const trigger = page.locator('.bava-control-trigger').first();
  await trigger.click();
  const popover = page.locator('.bava-control-popover').filter({ visible: true });
  await expect(popover).toBeVisible();
  await clickAway(page, 'outside');
  await expect(popover).toHaveCount(0);
});
