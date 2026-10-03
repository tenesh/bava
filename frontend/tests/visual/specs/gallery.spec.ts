import { expect, test } from '@playwright/test';
import {
  THEMES,
  cell,
  galleryShot,
  hovered,
  imagesLoaded,
  menus,
  openDialog,
  openGallery,
  popovers,
  pressOn,
  restPointer,
  shotDialog,
  shotFloating,
  shotPane,
  stage,
  tabTo,
  tooltips,
} from './helpers';

// Every component in src/components, alone in the gallery page, in each state
// it can show, in both themes. A state a person reaches with the pointer or
// the keyboard is reached that way here; the rest are set up by the demo.

for (const theme of THEMES) {
  test.describe(`the component gallery, ${theme}`, () => {
    test('About', async ({ page }) => {
      await openGallery(page, 'AboutDialog', theme);
      await restPointer(page);
      await shotDialog(page, galleryShot('AboutDialog', 'open', theme));
    });

    test('the block handle at rest, hovered and focused', async ({ page }) => {
      await openGallery(page, 'BlockHandle', theme);
      const [add, grip] = [page.getByRole('button', { name: 'Add a block after' }), page.getByRole('button', { name: 'Drag, or open the block menu' })];
      await restPointer(page);
      await shotPane(stage(page), galleryShot('BlockHandle', 'rest', theme));
      await add.hover();
      expect(await hovered(add)).toBe(true);
      await shotPane(stage(page), galleryShot('BlockHandle', 'hover', theme));
      await restPointer(page);
      await tabTo(page, grip);
      await shotPane(stage(page), galleryShot('BlockHandle', 'focus', theme));
    });

    test('the zoom buttons at three zooms, hovered, pressed and focused', async ({ page }) => {
      await openGallery(page, 'CanvasControls', theme);
      await restPointer(page);
      await expect(stage(page).locator('.readout')).toHaveText(['100%', '25%', '400%']);
      await shotPane(stage(page), galleryShot('CanvasControls', 'zooms', theme));
      const zoomIn = cell(page, '100%').getByRole('button', { name: 'Zoom in' });
      await zoomIn.hover();
      expect(await hovered(zoomIn)).toBe(true);
      await shotPane(cell(page, '100%'), galleryShot('CanvasControls', 'hover', theme));
      await pressOn(page, zoomIn);
      await shotPane(cell(page, '100%'), galleryShot('CanvasControls', 'pressed', theme));
      await page.mouse.up();
      await restPointer(page);
      await tabTo(page, cell(page, '25%').getByRole('button', { name: 'Zoom in' }));
      await shotPane(cell(page, '25%'), galleryShot('CanvasControls', 'focus', theme));
    });

    for (const [variant, state] of [['', 'two-options'], ['three', 'three-options']]) {
      test(`a confirmation with ${state.replace('-', ' ')}`, async ({ page }) => {
        await openGallery(page, 'ConfirmDialog', theme, variant);
        await expect(openDialog(page).getByRole('button')).toHaveCount(variant ? 3 : 2);
        await restPointer(page);
        await shotDialog(page, galleryShot('ConfirmDialog', state, theme));
      });
    }

    test('the right-click menu, a row highlighted, a submenu open', async ({ page }) => {
      await openGallery(page, 'ContextMenu', theme);
      const area = cell(page, 'right-click on the canvas').locator('.area');
      await area.click({ button: 'right', position: { x: 24, y: 24 } });
      await expect(menus(page)).toHaveCount(1);
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, area, menus(page), galleryShot('ContextMenu', 'open', theme));
      await page.keyboard.press('ArrowDown');
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(1);
      await shotFloating(page, area, menus(page), galleryShot('ContextMenu', 'highlighted', theme));
      // Down the menu to its first submenu, opened from the keyboard.
      const submenuRow = menus(page).locator('[aria-haspopup="menu"]').first();
      for (let i = 0; i < 30 && (await submenuRow.getAttribute('data-highlighted')) === null; i += 1) await page.keyboard.press('ArrowDown');
      await expect(submenuRow).toHaveAttribute('data-highlighted', '');
      await page.keyboard.press('ArrowRight');
      await expect(menus(page)).toHaveCount(2);
      await shotFloating(page, area, menus(page), galleryShot('ContextMenu', 'submenu', theme));
    });

    test('the calendar, its day focused and another hovered', async ({ page }) => {
      await openGallery(page, 'DatePicker', theme);
      const chip = cell(page, 'under a date chip').locator('.chip');
      const calendar = page.getByRole('dialog', { name: 'Calendar' });
      await expect(calendar.locator('.day[data-selected]')).toBeFocused();
      await expect(calendar.locator('.day[data-selected]')).toHaveText('14');
      await restPointer(page);
      await shotFloating(page, chip, calendar, galleryShot('DatePicker', 'open', theme));
      const day = calendar.locator('.day:not([data-outside-range])', { hasText: /^20$/ });
      await day.hover();
      expect(await hovered(day)).toBe(true);
      await shotFloating(page, chip, calendar, galleryShot('DatePicker', 'hover', theme));
    });

    for (const [variant, state] of [['', 'tala'], ['dagre', 'dagre'], ['error', 'error'], ['empty', 'empty']]) {
      test(`Diagram from Code, ${state}`, async ({ page }) => {
        await openGallery(page, 'DiagramDialog', theme, variant);
        await expect(openDialog(page).locator('.cm-content')).toBeFocused();
        const insert = openDialog(page).getByRole('button', { name: 'Insert', exact: true });
        if (variant === 'error' || variant === 'empty') await expect(insert).toBeDisabled();
        else await expect(insert).toBeEnabled();
        if (variant === 'error') await expect(openDialog(page).locator('.errors li')).toHaveCount(1);
        await restPointer(page);
        await shotDialog(page, galleryShot('DiagramDialog', state, theme));
      });
    }

    for (const [variant, state] of [['', 'sectioned'], ['alert', 'alert']]) {
      test(`the dialog frame, ${state}`, async ({ page }) => {
        await openGallery(page, 'Dialog', theme, variant);
        await expect(openDialog(page)).toHaveAttribute('data-variant', variant || 'sectioned');
        await restPointer(page);
        await shotDialog(page, galleryShot('Dialog', state, theme));
      });
    }

    test('the dialog frame, its close button hovered', async ({ page }) => {
      await openGallery(page, 'Dialog', theme);
      const close = openDialog(page).locator('.bava-dialog-close');
      await close.hover();
      expect(await hovered(close)).toBe(true);
      await shotDialog(page, galleryShot('Dialog', 'close-hover', theme));
    });

    test('the emoji picker open, searched, with no match and an emoji hovered', async ({ page }) => {
      await openGallery(page, 'EmojiPicker', theme);
      const anchor = cell(page, "under the page's icon").locator('.anchor');
      const picker = page.getByRole('dialog', { name: 'Emoji' });
      await expect(picker.getByRole('searchbox')).toBeFocused();
      await expect(picker.locator('h3').first()).toBeVisible();
      await restPointer(page);
      await shotFloating(page, anchor, picker, galleryShot('EmojiPicker', 'open', theme));
      const first = picker.locator('.emoji').first();
      await first.hover();
      expect(await hovered(first)).toBe(true);
      await shotFloating(page, anchor, picker, galleryShot('EmojiPicker', 'hover', theme));
      await restPointer(page);
      await page.keyboard.type('heart');
      await expect(picker.locator('h3')).toHaveCount(0);
      await expect(picker.locator('.emoji').first()).toBeVisible();
      await shotFloating(page, anchor, picker, galleryShot('EmojiPicker', 'search', theme));
      await page.keyboard.type('zzz');
      await expect(picker.getByText('No emoji match')).toBeVisible();
      await shotFloating(page, anchor, picker, galleryShot('EmojiPicker', 'none', theme));
    });

    test('the emoji picker while the emoji load', async ({ page }) => {
      await openGallery(page, 'EmojiPicker', theme, 'loading');
      const picker = page.getByRole('dialog', { name: 'Emoji' });
      await expect(picker.locator('.emoji')).toHaveCount(0);
      await restPointer(page);
      await shotFloating(page, cell(page, "under the page's icon").locator('.anchor'), picker, galleryShot('EmojiPicker', 'loading', theme));
    });

    test('empty states', async ({ page }) => {
      await openGallery(page, 'EmptyState', theme);
      await expect(stage(page).locator('[data-cell]')).toHaveCount(5);
      await shotPane(stage(page), galleryShot('EmptyState', 'states', theme));
    });

    for (const [variant, state] of [['', 'inline'], ['display', 'display'], ['empty', 'empty']]) {
      test(`the equation field, ${state}`, async ({ page }) => {
        await openGallery(page, 'EquationField', theme, variant);
        await expect(page.getByRole('textbox', { name: 'Equation' })).toBeFocused();
        if (variant !== 'empty') await expect(page.locator('.equation-preview .katex')).toBeVisible();
        await restPointer(page);
        await shotFloating(page, cell(page, 'under its equation').locator('.anchor'), page.locator('.equation-field'), galleryShot('EquationField', state, theme));
      });
    }

    for (const [variant, state] of [['', 'with-details'], ['plain', 'without-details']]) {
      test(`an unexpected error, ${state.replace('-', ' ')}`, async ({ page }) => {
        await openGallery(page, 'ErrorDialog', theme, variant);
        await expect(openDialog(page).locator('dt')).toHaveCount(variant ? 0 : 3);
        await restPointer(page);
        await shotDialog(page, galleryShot('ErrorDialog', state, theme));
      });
    }

    for (const [variant, state] of [['', 'default'], ['selection', 'selection']]) {
      test(`Export, ${state}`, async ({ page }) => {
        await openGallery(page, 'ExportDialog', theme, variant);
        const only = openDialog(page).getByRole('checkbox', { name: 'Only selected' });
        if (variant) await expect(only).toBeChecked();
        else await expect(only).toBeDisabled();
        await expect(openDialog(page).locator('.bava-export-preview svg')).toBeVisible();
        await restPointer(page);
        await shotDialog(page, galleryShot('ExportDialog', state, theme));
      });
    }

    test('the find bar empty, with matches, a button hovered, with none and replace focused', async ({ page }) => {
      await openGallery(page, 'FindBar', theme);
      const bar = page.getByRole('search');
      await expect(bar.getByRole('searchbox')).toBeFocused();
      await restPointer(page);
      await shotPane(stage(page), galleryShot('FindBar', 'empty', theme));
      await page.keyboard.type('plan');
      await expect(bar.locator('.position')).toHaveText('1 of 3');
      const previous = bar.getByRole('button', { name: 'Previous match' });
      const next = bar.getByRole('button', { name: 'Next match' });
      await expect(previous).toBeEnabled();
      await expect(next).toBeEnabled();
      await shotPane(stage(page), galleryShot('FindBar', 'matches', theme));
      await next.hover();
      expect(await hovered(next)).toBe(true);
      await shotPane(stage(page), galleryShot('FindBar', 'hover', theme));
      await restPointer(page);
      await tabTo(page, bar.getByRole('textbox', { name: 'Replace with' }));
      await shotPane(stage(page), galleryShot('FindBar', 'focus-replace', theme));
      await bar.getByRole('searchbox').fill('zzz');
      await expect(bar.locator('.position')).toHaveText('No matches');
      await expect(next).toBeDisabled();
      await shotPane(stage(page), galleryShot('FindBar', 'none', theme));
    });

    test('the formatting bubble, with and without Turn into, hovered and focused', async ({ page }) => {
      await openGallery(page, 'FormatBubble', theme);
      const bubbles = page.getByRole('toolbar', { name: 'Formatting' });
      await expect(bubbles).toHaveCount(2);
      await expect(bubbles.first().locator('[aria-pressed="true"]')).toHaveCount(2);
      await restPointer(page);
      await shotFloating(page, stage(page), bubbles, galleryShot('FormatBubble', 'states', theme));
      const first = cell(page, 'bold and a link');
      const italic = bubbles.first().getByRole('button', { name: 'Italic' });
      await italic.hover();
      expect(await hovered(italic)).toBe(true);
      await shotFloating(page, first, bubbles.first(), galleryShot('FormatBubble', 'hover', theme));
      await restPointer(page);
      await tabTo(page, bubbles.first().getByRole('button').first());
      await shotFloating(page, first, bubbles.first(), galleryShot('FormatBubble', 'focus', theme));
    });

    test('an icon at each size', async ({ page }) => {
      await openGallery(page, 'Icon', theme);
      await expect(stage(page).locator('svg')).toHaveCount(4);
      await shotPane(stage(page), galleryShot('Icon', 'sizes', theme));
    });

    test('the insert panel, a row hovered, a category, a search and no match', async ({ page }) => {
      await openGallery(page, 'InsertPanel', theme);
      const panel = page.getByRole('dialog');
      const options = panel.getByRole('option');
      await expect(panel.getByRole('combobox')).toBeFocused();
      await restPointer(page);
      await expect(options.first()).toHaveAttribute('aria-selected', 'true');
      await shotPane(stage(page), galleryShot('InsertPanel', 'categories', theme));
      await options.nth(1).hover();
      await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
      await shotPane(stage(page), galleryShot('InsertPanel', 'hover', theme));
      await options.first().click();
      await restPointer(page);
      await expect(panel.locator('.entries.grid')).toBeVisible();
      await expect(panel.locator('.crumbs .current')).not.toHaveText('All');
      await shotPane(stage(page), galleryShot('InsertPanel', 'category', theme));
      await page.keyboard.press('Backspace');
      await page.keyboard.type('dia');
      await expect(panel.locator('.entries.grid')).toBeVisible();
      await expect(options.first()).toHaveAttribute('aria-selected', 'true');
      await shotPane(stage(page), galleryShot('InsertPanel', 'search', theme));
      await page.keyboard.type('zzz');
      await expect(panel.getByText('Nothing matches')).toBeVisible();
      await shotPane(stage(page), galleryShot('InsertPanel', 'empty', theme));
    });

    test('the layout engine picker for each engine, hovered and focused', async ({ page }) => {
      await openGallery(page, 'LayoutEnginePicker', theme);
      await restPointer(page);
      await expect(stage(page).getByRole('radiogroup')).toHaveCount(5);
      await shotPane(stage(page), galleryShot('LayoutEnginePicker', 'states', theme));
      const dagre = cell(page, 'TALA').locator('.bava-segment', { hasText: 'Dagre' });
      await dagre.hover();
      expect(await hovered(dagre)).toBe(true);
      await shotPane(cell(page, 'TALA'), galleryShot('LayoutEnginePicker', 'hover', theme));
      await restPointer(page);
      await tabTo(page, cell(page, 'TALA').locator('input:checked'));
      await shotPane(cell(page, 'TALA'), galleryShot('LayoutEnginePicker', 'focus', theme));
    });

    test('link cards for a link, missing pages, a locked page and a long address, and a button hovered', async ({ page }) => {
      await openGallery(page, 'LinkCard', theme);
      const cards = page.locator('.link-card');
      await expect(cards).toHaveCount(5);
      await restPointer(page);
      await shotFloating(page, stage(page), cards, galleryShot('LinkCard', 'states', theme));
      const open = cards.first().getByRole('button', { name: 'Open' });
      await open.hover();
      expect(await hovered(open)).toBe(true);
      await shotFloating(page, cell(page, 'a link'), cards.first(), galleryShot('LinkCard', 'hover', theme));
    });

    test('a link card opened from the keyboard', async ({ page }) => {
      await openGallery(page, 'LinkCard', theme, 'keyboard');
      const card = page.locator('.link-card');
      await expect(card.getByRole('button').first()).toBeFocused();
      await restPointer(page);
      await shotFloating(page, cell(page, 'a link'), card, galleryShot('LinkCard', 'focus', theme));
    });

    for (const [variant, state] of [['', 'empty'], ['linked', 'linked'], ['caption', 'caption']]) {
      test(`the link field, ${state}`, async ({ page }) => {
        await openGallery(page, 'LinkField', theme, variant);
        const field = page.locator('.link-field');
        await expect(field.getByRole('textbox')).toBeFocused();
        await expect(field.getByRole('button')).toHaveCount(variant === 'linked' ? 1 : variant === 'caption' ? 0 : 1);
        await restPointer(page);
        await shotFloating(page, cell(page, 'over selected words').locator('.selected'), field, galleryShot('LinkField', state, theme));
      });
    }

    test('the mark at every size', async ({ page }) => {
      await openGallery(page, 'Mark', theme);
      await expect(stage(page).locator('.mark')).toHaveCount(6);
      await shotPane(stage(page), galleryShot('Mark', 'sizes', theme));
    });

    test('the Media dialog as a grid, a file chosen, renamed, as a list and with no match', async ({ page }) => {
      await openGallery(page, 'MediaDialog', theme);
      const dialog = openDialog(page);
      await expect(dialog.locator('.media-item')).toHaveCount(5);
      await imagesLoaded(dialog);
      await restPointer(page);
      await shotDialog(page, galleryShot('MediaDialog', 'grid', theme));
      await dialog.locator('[data-name="logo.png"]').click();
      await restPointer(page);
      await expect(dialog.locator('[data-name="logo.png"]')).toHaveAttribute('aria-selected', 'true');
      await imagesLoaded(dialog);
      await shotDialog(page, galleryShot('MediaDialog', 'chosen', theme));
      await dialog.getByRole('button', { name: 'Rename' }).click();
      await restPointer(page);
      await expect(dialog.locator('.media-rename')).toBeFocused();
      await shotDialog(page, galleryShot('MediaDialog', 'renaming', theme));
      // Enter with the name unchanged leaves it as it was.
      await page.keyboard.press('Enter');
      await expect(dialog.locator('.media-rename')).toHaveCount(0);
      await dialog.getByText('List', { exact: true }).click();
      await restPointer(page);
      await expect(dialog.locator('.media-items')).toHaveAttribute('data-view', 'list');
      await imagesLoaded(dialog);
      await shotDialog(page, galleryShot('MediaDialog', 'list', theme));
      await dialog.getByRole('searchbox').fill('zzz');
      await expect(dialog.getByText('No file has that name.')).toBeVisible();
      await shotDialog(page, galleryShot('MediaDialog', 'no-match', theme));
    });

    for (const [variant, state] of [['empty', 'empty'], ['unread', 'usage-unknown']]) {
      test(`the Media dialog, ${state.replace('-', ' ')}`, async ({ page }) => {
        await openGallery(page, 'MediaDialog', theme, variant);
        const dialog = openDialog(page);
        if (variant === 'empty') await expect(dialog.getByText('No files yet. Paste, drop or add them to a page.')).toBeVisible();
        else await expect(dialog.getByText('Not every page could be read: no file is marked unused.')).toBeVisible();
        await imagesLoaded(dialog);
        await restPointer(page);
        await shotDialog(page, galleryShot('MediaDialog', state, theme));
      });
    }

    test('the Media section with files, a row hovered and focused, and no match', async ({ page }) => {
      await openGallery(page, 'MediaSection', theme);
      const rows = stage(page).locator('.media-row');
      await expect(rows).toHaveCount(5);
      await imagesLoaded(stage(page));
      await restPointer(page);
      await shotPane(stage(page), galleryShot('MediaSection', 'items', theme));
      await rows.nth(1).hover();
      expect(await hovered(rows.nth(1))).toBe(true);
      await shotPane(stage(page), galleryShot('MediaSection', 'hover', theme));
      await restPointer(page);
      await tabTo(page, rows.first());
      await shotPane(stage(page), galleryShot('MediaSection', 'focus', theme));
      await stage(page).getByRole('searchbox').fill('zzz');
      await expect(stage(page).getByText('No file has that name.')).toBeVisible();
      await shotPane(stage(page), galleryShot('MediaSection', 'no-match', theme));
    });

    test('the Media section with no files', async ({ page }) => {
      await openGallery(page, 'MediaSection', theme, 'empty');
      await expect(stage(page).getByText('No files yet. Paste, drop or add them to a page.')).toBeVisible();
      await restPointer(page);
      await shotPane(stage(page), galleryShot('MediaSection', 'empty', theme));
    });

    test('thumbnails of each kind, at both sizes, and one that will not load', async ({ page }) => {
      await openGallery(page, 'MediaThumb', theme);
      // The image and the poster at each size; the missing picture gives way to its icon.
      await expect(stage(page).locator('img')).toHaveCount(4);
      await imagesLoaded(stage(page));
      await shotPane(stage(page), galleryShot('MediaThumb', 'states', theme));
    });

    test('an image full screen', async ({ page }) => {
      await openGallery(page, 'MediaViewer', theme);
      await page.getByRole('button', { name: 'Open the image' }).click();
      await expect(openDialog(page)).toBeVisible();
      await imagesLoaded(openDialog(page));
      await restPointer(page);
      await shotDialog(page, galleryShot('MediaViewer', 'open', theme));
    });

    test('New Space with no folder chosen', async ({ page }) => {
      await openGallery(page, 'NewSpaceDialog', theme);
      await expect(openDialog(page).getByRole('button', { name: 'Create' })).toBeDisabled();
      await restPointer(page);
      await shotDialog(page, galleryShot('NewSpaceDialog', 'empty', theme));
    });

    test('New Space named, with its folder chosen', async ({ page }) => {
      await openGallery(page, 'NewSpaceDialog', theme, 'located');
      await expect(openDialog(page).getByRole('textbox', { name: 'Name' })).toBeFocused();
      await page.keyboard.type('Garden plans');
      await expect(openDialog(page).getByRole('button', { name: 'Create' })).toBeEnabled();
      await restPointer(page);
      await shotDialog(page, galleryShot('NewSpaceDialog', 'ready', theme));
    });

    test('New Space with a long folder path', async ({ page }) => {
      await openGallery(page, 'NewSpaceDialog', theme, 'long');
      await expect(openDialog(page).locator('.path')).toContainText('Planning');
      await restPointer(page);
      await shotDialog(page, galleryShot('NewSpaceDialog', 'long-location', theme));
    });

    test('the opacity picker at rest, hovered, focused and open', async ({ page }) => {
      await openGallery(page, 'OpacityPicker', theme);
      const trigger = page.getByRole('button', { name: 'Opacity' });
      const room = cell(page, 'in the selection toolbar');
      await restPointer(page);
      await shotPane(stage(page), galleryShot('OpacityPicker', 'rest', theme));
      await trigger.hover();
      await expect(tooltips(page)).toHaveText('Opacity');
      await shotFloating(page, room, tooltips(page), galleryShot('OpacityPicker', 'hover', theme));
      await restPointer(page);
      await tabTo(page, trigger);
      await expect(tooltips(page)).toHaveText('Opacity');
      await shotFloating(page, room, tooltips(page), galleryShot('OpacityPicker', 'focus', theme));
      await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await restPointer(page);
      await expect(popovers(page).locator('.bava-slider-value')).toHaveText('60');
      await shotFloating(page, room, popovers(page), galleryShot('OpacityPicker', 'open', theme));
    });

    test('option pickers at rest, hovered, open, with More, and mixed', async ({ page }) => {
      await openGallery(page, 'OptionPicker', theme);
      const width = cell(page, 'stroke width').locator('.bava-control-trigger');
      const heads = cell(page, 'arrowheads, some behind More');
      const mixed = cell(page, 'mixed').locator('.bava-control-trigger');
      await restPointer(page);
      await shotPane(stage(page), galleryShot('OptionPicker', 'rest', theme));
      await width.hover();
      await expect(tooltips(page)).toHaveCount(1);
      await shotFloating(page, cell(page, 'stroke width'), tooltips(page), galleryShot('OptionPicker', 'hover', theme));
      await width.click();
      await restPointer(page);
      await expect(popovers(page).locator('.bava-option[data-state="checked"]')).toHaveCount(1);
      await shotFloating(page, width, popovers(page), galleryShot('OptionPicker', 'open', theme));
      await page.keyboard.press('Escape');
      await expect(popovers(page)).toHaveCount(0);
      await heads.locator('.bava-control-trigger').click();
      await restPointer(page);
      await expect(popovers(page).getByRole('button', { name: 'More' })).toBeVisible();
      await shotFloating(page, heads, popovers(page), galleryShot('OptionPicker', 'more', theme));
      await popovers(page).getByRole('button', { name: 'More' }).click();
      await restPointer(page);
      await expect(popovers(page).getByRole('button', { name: 'More' })).toHaveCount(0);
      await shotFloating(page, heads, popovers(page), galleryShot('OptionPicker', 'more-shown', theme));
      await page.keyboard.press('Escape');
      await expect(popovers(page)).toHaveCount(0);
      await mixed.click();
      await restPointer(page);
      await expect(popovers(page).locator('.bava-option')).toHaveCount(3);
      await expect(popovers(page).locator('.bava-option[data-state="checked"]')).toHaveCount(0);
      await shotFloating(page, mixed, popovers(page), galleryShot('OptionPicker', 'mixed', theme));
    });

    test('the page header, locked, long, its menu button hovered and focused', async ({ page }) => {
      await openGallery(page, 'PageHeader', theme);
      const menuButton = cell(page, 'a page in a folder').getByRole('button', { name: 'Page menu' });
      await restPointer(page);
      await expect(stage(page).locator('.locked')).toHaveCount(3);
      // Long folders are shortened beside a name that fits; beside one that
      // does not, they fold into one crumb.
      await expect(cell(page, 'a page in a folder').locator('nav')).toHaveAttribute('data-fit', 'whole');
      await expect(cell(page, 'long folders').locator('nav')).toHaveAttribute('data-fit', 'shorten');
      await expect(cell(page, 'long').locator('nav')).toHaveAttribute('data-fit', 'fold');
      await shotPane(stage(page), galleryShot('PageHeader', 'states', theme));
      await menuButton.hover();
      expect(await hovered(menuButton)).toBe(true);
      await shotPane(cell(page, 'a page in a folder'), galleryShot('PageHeader', 'hover', theme));
      await restPointer(page);
      await tabTo(page, menuButton);
      await shotPane(cell(page, 'a page in a folder'), galleryShot('PageHeader', 'focus', theme));
    });

    test('panes, titled and bare', async ({ page }) => {
      await openGallery(page, 'Pane', theme);
      await expect(stage(page).locator('.header')).toHaveCount(2);
      await shotPane(stage(page), galleryShot('Pane', 'states', theme));
    });

    test('a panel drawn and one that failed, its Reload focused', async ({ page }) => {
      await openGallery(page, 'PanelBoundary', theme);
      await expect(stage(page).getByRole('alert')).toHaveCount(1);
      await restPointer(page);
      await shotPane(stage(page), galleryShot('PanelBoundary', 'states', theme));
      await tabTo(page, stage(page).getByRole('button', { name: 'Reload panel' }));
      await shotPane(cell(page, 'failed'), galleryShot('PanelBoundary', 'focus', theme));
    });

    test('progress unknown, empty, part way and full', async ({ page }) => {
      await openGallery(page, 'Progress', theme);
      await expect(stage(page).locator('.bava-progress')).toHaveCount(4);
      await shotPane(stage(page), galleryShot('Progress', 'states', theme));
    });

    test('section tabs at rest, a tab hovered, focused and another chosen', async ({ page }) => {
      await openGallery(page, 'SectionTabs', theme);
      const tabs = stage(page).getByRole('tab');
      await restPointer(page);
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
      await shotPane(stage(page), galleryShot('SectionTabs', 'rest', theme));
      await tabs.nth(1).hover();
      expect(await hovered(tabs.nth(1))).toBe(true);
      await shotPane(stage(page), galleryShot('SectionTabs', 'hover', theme));
      await restPointer(page);
      await tabTo(page, tabs.first());
      await shotPane(stage(page), galleryShot('SectionTabs', 'focus', theme));
      await page.keyboard.press('ArrowDown');
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await expect(stage(page).getByText('Snap to objects')).toBeVisible();
      await shotPane(stage(page), galleryShot('SectionTabs', 'second', theme));
    });

    test('segments at rest, hovered, pressed and focused', async ({ page }) => {
      await openGallery(page, 'Segments', theme);
      const [grid, list, table] = ['Grid', 'List', 'Table'].map((name) => stage(page).locator('.bava-segment', { hasText: name }));
      await restPointer(page);
      await expect(grid).toHaveAttribute('data-state', 'checked');
      await shotPane(stage(page), galleryShot('Segments', 'rest', theme));
      await list.hover();
      expect(await hovered(list)).toBe(true);
      await shotPane(stage(page), galleryShot('Segments', 'hover', theme));
      await pressOn(page, table);
      await shotPane(stage(page), galleryShot('Segments', 'pressed', theme));
      await page.mouse.up();
      await restPointer(page);
      await expect(table).toHaveAttribute('data-state', 'checked');
      // Back into the group from the keyboard, as a person reaching it with
      // Tab: the ring is for keyboard focus, not for the press before.
      await page.keyboard.press('Tab');
      await expect(table.locator('input')).not.toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(table.locator('input')).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(list).toHaveAttribute('data-state', 'checked');
      await expect(list.locator('input')).toBeFocused();
      await shotPane(stage(page), galleryShot('Segments', 'focus', theme));
    });

    test('the selection toolbar for each kind of selection, and More hovered', async ({ page }) => {
      await openGallery(page, 'SelectionToolbar', theme);
      await expect(stage(page).getByRole('toolbar', { name: 'Selection' })).toHaveCount(6);
      await restPointer(page);
      await shotPane(stage(page), galleryShot('SelectionToolbar', 'states', theme));
      const more = cell(page, 'one shape').getByRole('button', { name: 'More actions' });
      await more.hover();
      await expect(tooltips(page)).toHaveText('More actions');
      await shotFloating(page, cell(page, 'one shape'), tooltips(page), galleryShot('SelectionToolbar', 'hover', theme));
    });

    test('Keyboard shortcuts', async ({ page }) => {
      await openGallery(page, 'ShortcutsDialog', theme);
      await expect(openDialog(page).locator('.group').first()).toBeVisible();
      await restPointer(page);
      await shotDialog(page, galleryShot('ShortcutsDialog', 'open', theme));
    });

    for (const [variant, state] of [['', 'grouped'], ['emoji', 'emoji'], ['empty', 'empty']]) {
      test(`the / menu, ${state}`, async ({ page }) => {
        await openGallery(page, 'SlashMenu', theme, variant);
        const menu = page.locator('.slash-menu');
        await expect(menu.locator('[data-highlighted]')).toHaveCount(variant === 'empty' ? 0 : 1);
        await restPointer(page);
        await shotFloating(page, cell(page, 'under the caret').locator('.typed'), menu, galleryShot('SlashMenu', state, theme));
      });
    }

    test('Space settings as opened, changed, and with no name', async ({ page }) => {
      await openGallery(page, 'SpaceSettingsDialog', theme);
      const dialog = openDialog(page);
      const name = dialog.getByRole('textbox', { name: 'Name' });
      await expect(name).toBeFocused();
      await restPointer(page);
      await shotDialog(page, galleryShot('SpaceSettingsDialog', 'default', theme));
      await name.fill('Acme Platform');
      await dialog.locator('.bava-segment', { hasText: 'Narrow' }).click();
      await expect(dialog.locator('.bava-segment', { hasText: 'Narrow' })).toHaveAttribute('data-state', 'checked');
      await restPointer(page);
      await shotDialog(page, galleryShot('SpaceSettingsDialog', 'changed', theme));
      await name.fill('');
      await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
      await shotDialog(page, galleryShot('SpaceSettingsDialog', 'no-name', theme));
    });

    test('the Space switcher at rest, hovered, focused, open and a row highlighted', async ({ page }) => {
      await openGallery(page, 'SpaceSwitcher', theme);
      const trigger = page.getByRole('button', { name: 'Switch Space' });
      await restPointer(page);
      await shotPane(stage(page), galleryShot('SpaceSwitcher', 'rest', theme));
      await trigger.hover();
      expect(await hovered(trigger)).toBe(true);
      await shotPane(stage(page), galleryShot('SpaceSwitcher', 'hover', theme));
      await restPointer(page);
      await tabTo(page, trigger);
      await shotPane(stage(page), galleryShot('SpaceSwitcher', 'focus', theme));
      await trigger.click();
      await expect(menus(page)).toBeVisible();
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await shotFloating(page, trigger, menus(page), galleryShot('SpaceSwitcher', 'open', theme));
      await page.keyboard.press('ArrowDown');
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(1);
      await shotFloating(page, trigger, menus(page), galleryShot('SpaceSwitcher', 'highlighted', theme));
    });

    test('the Space switcher with no recent Spaces, open', async ({ page }) => {
      await openGallery(page, 'SpaceSwitcher', theme, 'alone');
      const trigger = page.getByRole('button', { name: 'Switch Space' });
      await trigger.click();
      await expect(menus(page)).toBeVisible();
      await restPointer(page);
      await expect(menus(page).locator('.bava-menu-group')).toHaveCount(0);
      await shotFloating(page, trigger, menus(page), galleryShot('SpaceSwitcher', 'open-alone', theme));
    });

    test('the Space switcher with a long name', async ({ page }) => {
      await openGallery(page, 'SpaceSwitcher', theme, 'long');
      await restPointer(page);
      await expect(stage(page).locator('.name')).toContainText('Quarterly');
      await shotPane(stage(page), galleryShot('SpaceSwitcher', 'long', theme));
    });

    test('the Files tree at rest, a row hovered, focused, renamed and a folder folded', async ({ page }) => {
      await openGallery(page, 'SpaceTree', theme);
      const architecture = stage(page).locator('[data-path="Engineering/Architecture.md"]');
      const roadmap = stage(page).locator('[data-path="Roadmap.md"]');
      const field = stage(page).getByRole('textbox', { name: 'Name' });
      await restPointer(page);
      await expect(architecture).toHaveAttribute('data-selected', '');
      await shotPane(stage(page), galleryShot('SpaceTree', 'rest', theme));
      await roadmap.hover();
      expect(await hovered(roadmap)).toBe(true);
      await shotPane(stage(page), galleryShot('SpaceTree', 'hover', theme));
      await restPointer(page);
      // The tree is one stop: Tab reaches the row it holds the focus on.
      await tabTo(page, stage(page).locator('[data-path][tabindex="0"]'));
      await shotPane(stage(page), galleryShot('SpaceTree', 'focus', theme));
      await page.keyboard.press('F2');
      await expect(field).toBeFocused();
      await shotPane(stage(page), galleryShot('SpaceTree', 'renaming', theme));
      await page.keyboard.press('Escape');
      await expect(field).toHaveCount(0);
      await stage(page).locator('[data-path="Engineering"]').click();
      await restPointer(page);
      await expect(architecture).toBeHidden();
      await shotPane(stage(page), galleryShot('SpaceTree', 'folded', theme));
    });

    test('the Files tree naming a new page', async ({ page }) => {
      await openGallery(page, 'SpaceTree', theme, 'naming');
      await expect(stage(page).getByRole('textbox', { name: 'Name' })).toBeFocused();
      await restPointer(page);
      await shotPane(stage(page), galleryShot('SpaceTree', 'naming', theme));
    });

    test('the splash', async ({ page }) => {
      await openGallery(page, 'Splash', theme);
      await expect(page.locator('[data-part="splash"] .status')).not.toBeEmpty();
      await shotPane(page.locator('[data-part="splash"]'), galleryShot('Splash', 'open', theme));
    });

    test('splitters at rest, a handle hovered, focused and dragged', async ({ page }) => {
      await openGallery(page, 'Splitter', theme);
      const handle = cell(page, 'side by side').locator('.bava-splitter-handle');
      await restPointer(page);
      await expect(stage(page).locator('.bava-splitter-handle')).toHaveCount(2);
      await shotPane(stage(page), galleryShot('Splitter', 'rest', theme));
      // The handle is one pixel wide: the pointer goes on that pixel, not on its middle, which the
      // browser rounds onto the panel beside it.
      await handle.hover({ position: { x: 0, y: 20 } });
      expect(await hovered(handle)).toBe(true);
      await shotPane(cell(page, 'side by side'), galleryShot('Splitter', 'hover', theme));
      await restPointer(page);
      await tabTo(page, handle);
      await shotPane(cell(page, 'side by side'), galleryShot('Splitter', 'focus', theme));
      const box = (await handle.boundingBox())!;
      await page.mouse.move(box.x, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + 60, box.y + 20, { steps: 6 });
      await expect(handle).toHaveAttribute('data-dragging', '');
      await shotPane(cell(page, 'side by side'), galleryShot('Splitter', 'dragging', theme));
      await page.mouse.up();
    });

    test('the start screen with recent Spaces, one hovered, and focused', async ({ page }) => {
      await openGallery(page, 'StartScreen', theme);
      const recents = stage(page).locator('.recent');
      await expect(recents).toHaveCount(3);
      await expect(recents.nth(1)).toBeDisabled();
      await restPointer(page);
      await shotPane(stage(page), galleryShot('StartScreen', 'recents', theme));
      await recents.first().hover();
      expect(await hovered(recents.first())).toBe(true);
      await shotPane(stage(page), galleryShot('StartScreen', 'hover', theme));
      await restPointer(page);
      await tabTo(page, stage(page).getByRole('button', { name: 'New Space' }));
      await shotPane(stage(page), galleryShot('StartScreen', 'focus', theme));
    });

    test('the start screen with no recent Spaces', async ({ page }) => {
      await openGallery(page, 'StartScreen', theme, 'empty');
      await expect(stage(page).locator('.recent')).toHaveCount(0);
      await restPointer(page);
      await shotPane(stage(page), galleryShot('StartScreen', 'empty', theme));
    });

    test('the status bar for the canvas, the document, a message, nothing open and a long path', async ({ page }) => {
      await openGallery(page, 'StatusBar', theme);
      await expect(stage(page).locator('footer')).toHaveCount(6);
      await expect(stage(page).getByRole('status')).toHaveText('Autosave paused: the file changed on disk');
      await shotPane(stage(page), galleryShot('StatusBar', 'states', theme));
    });

    test('the colour chips for each selection', async ({ page }) => {
      await openGallery(page, 'StyleBar', theme);
      await restPointer(page);
      await expect(stage(page).locator('.chip')).toHaveCount(13);
      await shotPane(stage(page), galleryShot('StyleBar', 'states', theme));
    });

    test('a colour chip hovered, and its swatches open', async ({ page }) => {
      await openGallery(page, 'StyleBar', theme, 'swatches');
      const fill = stage(page).getByRole('button', { name: 'Fill colour' });
      await fill.hover();
      await expect(tooltips(page)).toHaveText('Fill colour');
      await shotFloating(page, fill, tooltips(page), galleryShot('StyleBar', 'hover', theme));
      await fill.click();
      await restPointer(page);
      await expect(popovers(page).locator('.bava-swatch[data-state="checked"]')).toHaveAttribute('title', /blue/i);
      await shotFloating(page, fill, popovers(page), galleryShot('StyleBar', 'open', theme));
    });

    test('the swatches for a colour of its own', async ({ page }) => {
      await openGallery(page, 'StyleBar', theme, 'own');
      const fill = stage(page).getByRole('button', { name: 'Fill colour' });
      await fill.click();
      await restPointer(page);
      await expect(popovers(page).getByRole('textbox')).toHaveValue('#ffe066');
      await shotFloating(page, fill, popovers(page), galleryShot('StyleBar', 'custom', theme));
    });

    test('toggles off, on, disabled and as rows, hovered and focused', async ({ page }) => {
      await openGallery(page, 'Toggle', theme);
      const off = cell(page, 'off').locator('.bava-toggle');
      await restPointer(page);
      await expect(stage(page).getByRole('checkbox', { checked: true })).toHaveCount(3);
      await shotPane(stage(page), galleryShot('Toggle', 'states', theme));
      await off.hover();
      expect(await hovered(off)).toBe(true);
      await shotPane(cell(page, 'off'), galleryShot('Toggle', 'hover', theme));
      await restPointer(page);
      await tabTo(page, cell(page, 'off').getByRole('checkbox'));
      await expect(cell(page, 'off').locator('.bava-toggle:has(input:focus-visible)')).toHaveCount(1);
      await shotPane(cell(page, 'off'), galleryShot('Toggle', 'focus', theme));
    });

    test('every interface icon', async ({ page }) => {
      await openGallery(page, 'ToolIcon', theme);
      // Every icon draws: none is left without its picture.
      const blank = await cell(page, 'every icon, md').locator('.glyph').evaluateAll((glyphs) => glyphs.filter((glyph) => !glyph.querySelector('svg')).map((glyph) => glyph.textContent));
      expect(blank).toEqual([]);
      await shotPane(stage(page), galleryShot('ToolIcon', 'all', theme));
    });

    test('the tool rail with a tool chosen, Insert open, locked, a tool hovered, focused and pressed', async ({ page }) => {
      await openGallery(page, 'ToolRail', theme);
      const rail = cell(page, 'Select');
      await restPointer(page);
      await expect(cell(page, 'Rectangle').getByRole('button', { name: 'Rectangle', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(cell(page, 'Insert open').locator('[data-insert-trigger]')).toHaveAttribute('aria-expanded', 'true');
      await expect(cell(page, 'locked').getByRole('button', { name: 'Keep tool after drawing' })).toHaveAttribute('aria-pressed', 'true');
      await shotPane(stage(page), galleryShot('ToolRail', 'states', theme));
      await rail.getByRole('button', { name: 'Ellipse', exact: true }).hover();
      await expect(tooltips(page)).toContainText('Ellipse');
      await shotFloating(page, rail, tooltips(page), galleryShot('ToolRail', 'hover', theme));
      await restPointer(page);
      await tabTo(page, rail.locator('[data-insert-trigger]'));
      await expect(tooltips(page)).toContainText('Insert');
      await shotFloating(page, rail, tooltips(page), galleryShot('ToolRail', 'focus', theme));
      await pressOn(page, rail.getByRole('button', { name: 'Text', exact: true }));
      await shotPane(rail, galleryShot('ToolRail', 'pressed', theme));
      await page.mouse.up();
    });

    test('a tooltip on hover, above its control, and on focus', async ({ page }) => {
      await openGallery(page, 'Tooltip', theme);
      const right = page.getByRole('button', { name: 'Rectangle' });
      const above = page.getByRole('button', { name: 'Align left edges' });
      await right.hover();
      await expect(tooltips(page)).toHaveText('Rectangle R');
      await shotFloating(page, right, tooltips(page), galleryShot('Tooltip', 'hover', theme));
      await above.hover();
      await expect(tooltips(page)).toHaveText('Align left edges');
      await shotFloating(page, above, tooltips(page), galleryShot('Tooltip', 'above', theme));
      await restPointer(page);
      await tabTo(page, right);
      await expect(tooltips(page)).toHaveText('Rectangle R');
      await shotFloating(page, right, tooltips(page), galleryShot('Tooltip', 'focus', theme));
    });

    test('the Trash with items, a row hovered and chosen, and no match', async ({ page }) => {
      await openGallery(page, 'TrashDialog', theme);
      const dialog = openDialog(page);
      const rows = dialog.locator('li.item');
      await expect(rows).toHaveCount(3);
      await expect(dialog.getByRole('searchbox')).toBeFocused();
      await restPointer(page);
      await shotDialog(page, galleryShot('TrashDialog', 'items', theme));
      await rows.first().hover();
      expect(await hovered(rows.first())).toBe(true);
      await shotDialog(page, galleryShot('TrashDialog', 'hover', theme));
      await rows.nth(1).click();
      await restPointer(page);
      await expect(rows.nth(1)).toHaveClass(/selected/);
      await shotDialog(page, galleryShot('TrashDialog', 'chosen', theme));
      await dialog.getByRole('searchbox').fill('zzz');
      await expect(rows).toHaveCount(0);
      await shotDialog(page, galleryShot('TrashDialog', 'no-match', theme));
    });

    test('the Trash, empty', async ({ page }) => {
      await openGallery(page, 'TrashDialog', theme, 'empty');
      await expect(openDialog(page).getByText('The Trash is empty.')).toBeVisible();
      await restPointer(page);
      await shotDialog(page, galleryShot('TrashDialog', 'empty', theme));
    });

    test('the view switcher on each view, hovered and focused', async ({ page }) => {
      await openGallery(page, 'ViewSwitcher', theme);
      const canvas = cell(page, 'document').locator('.bava-segment', { hasText: 'Canvas' });
      await restPointer(page);
      await expect(cell(page, 'both').locator('.bava-segment', { hasText: 'Both' })).toHaveAttribute('data-state', 'checked');
      await shotPane(stage(page), galleryShot('ViewSwitcher', 'states', theme));
      await canvas.hover();
      expect(await hovered(canvas)).toBe(true);
      await shotPane(cell(page, 'document'), galleryShot('ViewSwitcher', 'hover', theme));
      await restPointer(page);
      await tabTo(page, cell(page, 'document').locator('input:checked'));
      await shotPane(cell(page, 'document'), galleryShot('ViewSwitcher', 'focus', theme));
    });
  });
}
