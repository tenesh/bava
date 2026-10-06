import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  cell,
  clickAway,
  editor,
  imagesLoaded,
  menu,
  menus,
  newLineAtEnd,
  openApp,
  openDialog,
  openDocument,
  openGallery,
  openPage,
  openSpace,
  personPace,
  popovers,
  restPointer,
  selectWord,
  stage,
  tabTo,
} from '../helpers';

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
  await page.getByRole('button', { name: 'Add to Files' }).click();
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

// What components do in a real browser, with its focus, keys and pointer: the
// component sheets picture how each state looks, and these how it is reached.
test.describe('components in the browser', () => {
  test('segments move their choice with the arrow keys, and ring a focus from the keyboard only', async ({ page }) => {
    await openGallery(page, 'Segments', 'light');
    const group = cell(page, 'rest').locator('.bava-segments');
    const segment = (name: string) => group.locator('.bava-segment', { hasText: name });
    await segment('Table').click();
    await expect(segment('Table')).toHaveAttribute('data-state', 'checked');
    // A press is not a keyboard focus: no ring after it.
    await expect(group).toHaveAttribute('data-pointer', '');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(segment('Table').locator('input')).toBeFocused();
    await expect(group).not.toHaveAttribute('data-pointer', '');
    await page.keyboard.press('ArrowLeft');
    await expect(segment('List')).toHaveAttribute('data-state', 'checked');
    await expect(segment('List').locator('input')).toBeFocused();
  });

  test('section tabs choose the next section with the arrow keys', async ({ page }) => {
    await openGallery(page, 'SectionTabs', 'light');
    const tabs = cell(page, 'rest').getByRole('tab');
    await restPointer(page);
    await tabTo(page, tabs.first());
    await page.keyboard.press('ArrowDown');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(cell(page, 'rest').getByText('Snap to objects')).toBeVisible();
  });

  test('a splitter handle dragged is marked and moves the panels', async ({ page }) => {
    await openGallery(page, 'Splitter', 'light');
    const handle = cell(page, 'side by side').locator('.bava-splitter-handle');
    const panel = cell(page, 'side by side').locator('.bava-splitter-panel').first();
    const before = (await panel.boundingBox())!.width;
    const box = (await handle.boundingBox())!;
    // The handle is one pixel wide: the pointer goes on that pixel.
    await page.mouse.move(box.x, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 20, { steps: 6 });
    await expect(handle).toHaveAttribute('data-dragging', '');
    await page.mouse.up();
    await expect.poll(async () => (await panel.boundingBox())!.width).toBeGreaterThan(before);
  });

  test('a toggle reached from the keyboard rings its focus', async ({ page }) => {
    await openGallery(page, 'Toggle', 'light');
    await restPointer(page);
    await tabTo(page, cell(page, 'off').getByRole('checkbox'));
    await expect(cell(page, 'off').locator('.bava-toggle:has(input:focus-visible)')).toHaveCount(1);
  });

  test('the emoji picker narrows to a search, and says when nothing matches', async ({ page }) => {
    await openGallery(page, 'EmojiPicker', 'light');
    // The picker with its emoji opens after the one still loading them.
    const picker = page.locator('.emoji-picker').last();
    await expect(picker.locator('.emoji').first()).toBeVisible();
    await picker.getByRole('searchbox').fill('heart');
    await expect(picker.locator('h3')).toHaveCount(0);
    await expect(picker.locator('.emoji').first()).toBeVisible();
    await picker.getByRole('searchbox').fill('zzz');
    await expect(picker.getByText('No emoji match')).toBeVisible();
  });

  test('the Files tree is one Tab stop, and renames with F2', async ({ page }) => {
    await openGallery(page, 'SpaceTree', 'light');
    const tree = cell(page, "a Space's files");
    await restPointer(page);
    await tabTo(page, tree.locator('[data-path][tabindex="0"]'));
    await page.keyboard.press('F2');
    const field = tree.getByRole('textbox', { name: 'Name' });
    await expect(field).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
  });

  test('the insert panel highlights the row under the pointer and opens a category on a click', async ({ page }) => {
    await openGallery(page, 'InsertPanel', 'light');
    const panel = cell(page, 'the categories');
    const options = panel.getByRole('option');
    await options.nth(1).hover();
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await options.first().click();
    await expect(panel.locator('.entries.grid')).toBeVisible();
  });
});

// What each dialog and screen component holds and does as it changes; their
// looks are pictured in the app's screens.
test.describe('dialogs and screens, alone', () => {
  for (const [variant, buttons] of [['', 2], ['three', 3]] as const) {
    test(`a confirmation offers ${buttons} choices`, async ({ page }) => {
      await openGallery(page, 'ConfirmDialog', 'light', variant);
      await expect(openDialog(page).getByRole('button')).toHaveCount(buttons);
    });
  }

  test('the Media dialog chooses a file, renames it, shows a list, and says when nothing matches', async ({ page }) => {
    await openGallery(page, 'MediaDialog', 'light');
    const dialog = openDialog(page);
    await expect(dialog.locator('.media-item')).toHaveCount(5);
    await imagesLoaded(dialog);
    await dialog.locator('[data-name="logo.png"]').click();
    await expect(dialog.locator('[data-name="logo.png"]')).toHaveAttribute('aria-selected', 'true');
    await dialog.getByRole('button', { name: 'Rename' }).click();
    await expect(dialog.locator('.media-rename')).toBeFocused();
    // Enter with the name unchanged leaves it as it was.
    await page.keyboard.press('Enter');
    await expect(dialog.locator('.media-rename')).toHaveCount(0);
    await dialog.getByText('List', { exact: true }).click();
    await expect(dialog.locator('.media-items')).toHaveAttribute('data-view', 'list');
    await dialog.getByRole('searchbox').fill('zzz');
    await expect(dialog.getByText('No file has that name.')).toBeVisible();
  });

  for (const [variant, words] of [
    ['empty', 'No files yet. Paste, drop or add them to a page.'],
    ['unread', 'Not every page could be read: no file is marked unused.'],
  ] as const) {
    test(`the Media dialog, ${variant}, says so`, async ({ page }) => {
      await openGallery(page, 'MediaDialog', 'light', variant);
      await expect(openDialog(page).getByText(words)).toBeVisible();
    });
  }

  test('the Trash opens searching, chooses a row, and empties to nothing matching', async ({ page }) => {
    await openGallery(page, 'TrashDialog', 'light');
    const dialog = openDialog(page);
    const rows = dialog.locator('li.item');
    await expect(rows).toHaveCount(3);
    await expect(dialog.getByRole('searchbox')).toBeFocused();
    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveClass(/selected/);
    await dialog.getByRole('searchbox').fill('zzz');
    await expect(rows).toHaveCount(0);
  });

  test('the Trash, empty, says so', async ({ page }) => {
    await openGallery(page, 'TrashDialog', 'light', 'empty');
    await expect(openDialog(page).getByText('The Trash is empty.')).toBeVisible();
  });

  test('the start screen offers a recent Space that is gone as disabled, and none when there are none', async ({ page }) => {
    await openGallery(page, 'StartScreen', 'light');
    const recents = stage(page).locator('.recent');
    await expect(recents).toHaveCount(3);
    await expect(recents.nth(1)).toBeDisabled();
    await openGallery(page, 'StartScreen', 'light', 'empty');
    await expect(stage(page).locator('.recent')).toHaveCount(0);
  });

  test('an option picker opens with its choice checked, a mixed one with none, and Escape closes it', async ({ page }) => {
    await openGallery(page, 'OptionPicker', 'light');
    await cell(page, 'stroke width').locator('.bava-control-trigger').click();
    await expect(popovers(page).locator('.bava-option[data-state="checked"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(popovers(page)).toHaveCount(0);
    await cell(page, 'mixed').locator('.bava-control-trigger').click();
    await expect(popovers(page).locator('.bava-option')).toHaveCount(3);
    await expect(popovers(page).locator('.bava-option[data-state="checked"]')).toHaveCount(0);
  });

  test('the Space switcher opens with no row highlighted, and ArrowDown highlights one', async ({ page }) => {
    await openGallery(page, 'SpaceSwitcher', 'light', 'open');
    await page.getByRole('button', { name: 'Switch Space' }).click();
    await expect(menus(page)).toBeVisible();
    await restPointer(page);
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
    // The key goes to the menu once it holds focus, as it does by the time a person presses one.
    await expect(menus(page)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menus(page).locator('[data-highlighted]')).toHaveCount(1);
  });

  // Focus on opening is the link field's unit test.
  test('the link field offers Remove link for a link, and no button for a caption', async ({ page }) => {
    await openGallery(page, 'LinkField', 'light');
    const fields = page.locator('.link-field');
    await expect(fields).toHaveCount(3);
    await expect(fields.nth(0).getByRole('button')).toHaveCount(1);
    await expect(fields.nth(1).getByRole('button', { name: 'Remove link' })).toBeVisible();
    await expect(fields.nth(2).getByRole('button')).toHaveCount(0);
  });
});
