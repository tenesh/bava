import { expect, test, type Page } from '@playwright/test';
import {
  THEMES,
  cell,
  componentShot,
  imagesLoaded,
  menus,
  openGallery,
  openSheet,
  popovers,
  restPointer,
  sheetShot,
  shotFloating,
  shotPane,
  stage,
  tooltips,
  type Theme,
} from '../helpers';

// Every component in src/components on its family's sheet
// (harness/gallery/sheets.ts), each state side by side, in both themes. A
// state the page can say is asserted from it before the picture; hovered,
// focused and pressed are forced on (harness/force-states.ts). A piece that
// opens on a press is pictured opened, one at a time.

/** A sheet's picture, after what it shows is checked. */
async function sheet(page: Page, name: string, theme: Theme, check: () => Promise<void>) {
  await openSheet(page, name, theme);
  await check();
  await shotPane(stage(page), sheetShot(name, theme));
}

for (const theme of THEMES) {
  test.describe(`the component sheets, ${theme}`, () => {
    test('controls', async ({ page }) => {
      await sheet(page, 'controls', theme, async () => {
        await expect(cell(page, 'rest').locator('.bava-segment[data-state="checked"]')).toHaveText('Grid');
        await expect(stage(page).locator('[data-demo="Toggle"]').getByRole('checkbox', { checked: true })).toHaveCount(4);
        await expect(stage(page).locator('[data-demo="SectionTabs"]').getByRole('tab', { selected: true })).toHaveCount(4);
        await expect(stage(page).locator('[data-demo="LayoutEnginePicker"]').getByRole('radiogroup')).toHaveCount(5);
      });
    });

    test('pickers', async ({ page }) => {
      await sheet(page, 'pickers', theme, async () => {
        await expect(page.locator('.date-picker .day[data-selected]')).toHaveText('14');
        await expect(page.locator('.emoji-picker h3').first()).toBeVisible();
        await expect(page.locator('.emoji-picker').filter({ hasNot: page.locator('.emoji') })).toHaveCount(1);
        await expect(stage(page).locator('[data-demo="StyleBar"] .chip')).toHaveCount(22);
        // The arrowheads chip is the end-head icon: a line, its head and a dot.
        await expect(cell(page, 'arrowheads, some behind More').locator('.bava-control-trigger svg path')).toHaveCount(2);
      });
    });

    test('menus', async ({ page }) => {
      await sheet(page, 'menus', theme, async () => {
        await expect(page.locator('.slash-menu [data-highlighted]')).toHaveCount(2);
        await expect(page.locator('.slash-menu').getByText('Nothing matches')).toBeVisible();
        await expect(cell(page, 'a long name').locator('.name')).toContainText('Quarterly');
      });
    });

    test('fields', async ({ page }) => {
      await sheet(page, 'fields', theme, async () => {
        await expect(page.locator('.link-field')).toHaveCount(3);
        await expect(page.locator('.equation-preview .katex')).toHaveCount(2);
        await expect(cell(page, 'three matches').locator('.position')).toHaveText('1 of 3');
        await expect(cell(page, 'no match').locator('.position')).toHaveText('No matches');
        await expect(cell(page, 'no match').getByRole('button', { name: 'Next match' })).toBeDisabled();
      });
    });

    test('canvas chrome', async ({ page }) => {
      await sheet(page, 'canvas-chrome', theme, async () => {
        await expect(cell(page, 'Rectangle').getByRole('button', { name: 'Rectangle', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(cell(page, 'Insert open').locator('[data-insert-trigger]')).toHaveAttribute('aria-expanded', 'true');
        await expect(cell(page, 'locked').getByRole('button', { name: 'Keep tool after drawing' })).toHaveAttribute('aria-pressed', 'true');
        await expect(stage(page).getByRole('toolbar', { name: 'Selection' })).toHaveCount(7);
        await expect(stage(page).locator('[data-demo="CanvasControls"] .readout')).toHaveText(['100%', '25%', '400%', '100%', '100%']);
        await expect(cell(page, 'a row hovered').getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
        await expect(cell(page, 'a category').locator('.entries.grid')).toBeVisible();
        await expect(cell(page, 'nothing matching').getByText('Nothing matches')).toBeVisible();
      });
    });

    test('side pane', async ({ page }) => {
      await sheet(page, 'side-pane', theme, async () => {
        await expect(cell(page, "a Space's files").locator('[data-path="Engineering/Architecture.md"]')).toHaveAttribute('data-selected', '');
        await expect(cell(page, 'Engineering folded').locator('[data-path="Engineering/Architecture.md"]')).toBeHidden();
        await expect(cell(page, 'no match').getByText('No file has that name.')).toBeVisible();
        await expect(cell(page, 'no files').getByText('No files yet. Paste, drop or add them to a page.')).toBeVisible();
        // Long folders are shortened beside a name that fits; beside one that
        // does not, they fold into one crumb.
        await expect(cell(page, 'a page in a folder').locator('nav')).toHaveAttribute('data-fit', 'whole');
        await expect(cell(page, 'long folders').locator('nav')).toHaveAttribute('data-fit', 'shorten');
        await expect(cell(page, 'long').locator('nav')).toHaveAttribute('data-fit', 'fold');
        // The image and the poster at each size; the missing picture gives way to its icon.
        await expect(stage(page).locator('[data-demo="MediaThumb"] img')).toHaveCount(4);
        await imagesLoaded(stage(page));
      });
    });

    test('document floating', async ({ page }) => {
      await sheet(page, 'document-floating', theme, async () => {
        const bubbles = page.getByRole('toolbar', { name: 'Formatting' });
        await expect(bubbles).toHaveCount(2);
        await expect(bubbles.first().locator('[aria-pressed="true"]')).toHaveCount(2);
        await expect(page.locator('.link-card')).toHaveCount(5);
      });
    });

    test('feedback', async ({ page }) => {
      await sheet(page, 'feedback', theme, async () => {
        await expect(stage(page).getByRole('alert')).toHaveCount(2);
      });
    });
  });

  test.describe(`components opened, ${theme}`, () => {
    test('the arrowheads picker, with More, and More shown', async ({ page }) => {
      await openSheet(page, 'pickers', theme);
      const heads = cell(page, 'arrowheads, some behind More');
      await heads.locator('.bava-control-trigger').click();
      await restPointer(page);
      await expect(popovers(page).locator('.bava-option[data-state="checked"]')).toHaveCount(1);
      await expect(popovers(page).getByRole('button', { name: 'More' })).toBeVisible();
      await shotFloating(page, heads, popovers(page), componentShot('OptionPicker', 'more', theme));
      await popovers(page).getByRole('button', { name: 'More' }).click();
      await restPointer(page);
      await expect(popovers(page).getByRole('button', { name: 'More' })).toHaveCount(0);
      await shotFloating(page, heads, popovers(page), componentShot('OptionPicker', 'more-shown', theme));
    });

    test('the opacity slider', async ({ page }) => {
      await openSheet(page, 'pickers', theme);
      const room = cell(page, 'in the selection toolbar');
      await room.getByRole('button', { name: 'Opacity' }).click();
      await restPointer(page);
      await expect(popovers(page).locator('.bava-slider-value')).toHaveText('60');
      await shotFloating(page, room, popovers(page), componentShot('OpacityPicker', 'open', theme));
    });

    // One bar at a time: a chip is found by a fixed id, as the app has one bar.
    test('the swatches, and those for a colour of its own', async ({ page }) => {
      await openGallery(page, 'StyleBar', theme, 'swatches');
      const fill = stage(page).getByRole('button', { name: 'Fill colour' });
      await fill.click();
      await restPointer(page);
      await expect(popovers(page).locator('.bava-swatch[data-state="checked"]')).toHaveAttribute('title', /blue/i);
      await shotFloating(page, fill, popovers(page), componentShot('StyleBar', 'open', theme));
      await openGallery(page, 'StyleBar', theme, 'own');
      await stage(page).getByRole('button', { name: 'Fill colour' }).click();
      await restPointer(page);
      await expect(popovers(page).getByRole('textbox')).toHaveValue('#ffe066');
      await shotFloating(page, stage(page).getByRole('button', { name: 'Fill colour' }), popovers(page), componentShot('StyleBar', 'custom', theme));
    });

    // A submenu wears the same menu; opening one from the keyboard is the
    // component's unit test.
    test('the right-click menu, a row highlighted', async ({ page }) => {
      await openSheet(page, 'menus', theme);
      const area = cell(page, 'right-click on the canvas').locator('.area');
      // The sheet's / menus are menus too, open all along.
      const rightClickMenus = page.locator('.bava-menu:not(.slash-menu)').filter({ visible: true });
      await area.click({ button: 'right', position: { x: 24, y: 24 } });
      await expect(rightClickMenus).toHaveCount(1);
      // Keys go to the menu once it holds focus, a moment after it opens, and
      // the pointer leaves it first: a pointer leaving a menu takes its
      // highlight away.
      await expect(rightClickMenus).toBeFocused();
      await restPointer(page);
      await page.keyboard.press('ArrowDown');
      await expect(rightClickMenus.locator('[data-highlighted]')).toHaveCount(1);
      await shotFloating(page, area, rightClickMenus, componentShot('ContextMenu', 'highlighted', theme));
    });

    for (const [variant, state] of [['open', 'open'], ['alone', 'open-alone']]) {
      test(`the Space switcher, ${state.replace('-', ' ')}`, async ({ page }) => {
        await openGallery(page, 'SpaceSwitcher', theme, variant);
        const trigger = page.getByRole('button', { name: 'Switch Space' });
        await trigger.click();
        await expect(menus(page)).toBeVisible();
        await restPointer(page);
        if (variant === 'alone') await expect(menus(page).locator('.bava-menu-group')).toHaveCount(0);
        await shotFloating(page, trigger, menus(page), componentShot('SpaceSwitcher', state, theme));
      });
    }

    // The name field commits when it loses focus, so it is pictured alone, holding it.
    test('the Files tree naming a new page', async ({ page }) => {
      await openGallery(page, 'SpaceTree', theme, 'naming');
      await expect(stage(page).getByRole('textbox', { name: 'Name' })).toBeFocused();
      await restPointer(page);
      await shotPane(stage(page), componentShot('SpaceTree', 'naming', theme));
    });

    test('a tooltip with its key, and one above its control', async ({ page }) => {
      await openSheet(page, 'menus', theme);
      const right = page.getByRole('button', { name: 'Rectangle' });
      const above = page.getByRole('button', { name: 'Align left edges' });
      await right.hover();
      await expect(tooltips(page)).toHaveText('Rectangle R');
      await shotFloating(page, right, tooltips(page), componentShot('Tooltip', 'right', theme));
      await above.hover();
      await expect(tooltips(page)).toHaveText('Align left edges');
      await shotFloating(page, above, tooltips(page), componentShot('Tooltip', 'above', theme));
    });
  });
}
