import { expect, test, type Page } from '@playwright/test';
import { DOC_SHEETS, SUBJECTS, sheetPage, type DocSheet, type Subject } from '../fixtures/document-blocks';
import { box } from '../fixtures/canvas-scenes';
import {
  CANVAS_PAGE,
  SPACE,
  THEMES,
  openApp,
  openPage,
  seedScene,
  dragCells,
  documentPane,
  personPace,
  openSeeded,
  imagesLoaded,
  caretOnWord,
  caretAtStart,
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
} from '../helpers';

// What the Document draws, in both themes: pages of every block, inline piece
// and mark, at rest, unable to draw and empty, and the few states that look
// different (a selection under the bubble, a block's handle, a node or cells
// selected). What it does is in integration/document.spec.ts.

for (const theme of THEMES) {
  test.describe(`the Document, ${theme}`, () => {
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

    test('the formatting bubble on a selection', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      await selectWord(page, 'thousand');
      const bubble = page.getByRole('toolbar', { name: 'Formatting' });
      await expect(bubble).toBeVisible();
      await restPointer(page);
      await shotFloating(page, editor(page).locator('p', { hasText: 'thousand' }), bubble, shot('document', 'bubble', 'selection', theme));
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

    test('tables in both forms', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Tables.md');
      await expect(editor(page).locator('table')).toHaveCount(2);
      await expect(editor(page).locator('td[colspan="2"]')).toHaveCount(1);
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'table', 'page', theme));
    });

    test('four cells selected, then merged', async ({ page }) => {
      await openDocument(page, theme, 'Engineering/Tables.md');
      const table = editor(page).locator('table').first();
      await dragCells(page, 'Ana', 'Build');
      await expect(table.locator('.selectedCell')).toHaveCount(4);
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'table', 'cells-selected', theme));
      await rightClick(page, 'Build');
      // The right-click keeps the four cells selected, and the menu offers merging them.
      await expect(table.locator('.selectedCell')).toHaveCount(4);
      await expect(page.getByRole('menuitem', { name: 'Merge cells' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Split cell' })).toHaveCount(0);
      await expect(page.getByRole('menuitem', { name: 'Move row up' })).toHaveCount(0);
      await expect(page.getByRole('menuitem', { name: 'Delete rows' })).toBeVisible();
      // Opened by a press: no row is highlighted until the pointer or a key moves to one.
      await restPointer(page);
      await expect(menus(page).locator('[data-highlighted]')).toHaveCount(0);
      await page.getByRole('menuitem', { name: 'Merge cells' }).click();
      const merged = table.locator('[colspan="2"][rowspan="2"]');
      await expect(merged).toHaveCount(1);
      await expect(merged).toHaveText('AnaDesignBenBuild');
      // The page has focus back, and the merged cell is selected as a cell:
      // the browser's own highlight is hidden.
      await expect(editor(page)).toBeFocused();
      await expect(editor(page)).toHaveClass(/ProseMirror-hideselection/);
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'table', 'merged', theme));
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

  test.describe(`a canvas embed, ${theme}`, () => {
    test("this page's frame at its own size, with what was drawn over it", async ({ page }) => {
      await openApp(page, theme);
      // The first box was drawn before the frame, the second crosses its edge: both are pictured.
      await seedScene(page, CANVAS_PAGE, [
        { id: 'f1', type: 'frame', x: 100, y: 100, w: 320, h: 180, z: 1, label: 'Write path' },
        box('b1', 130, 150, { z: 2, label: 'API' }),
        box('b2', 360, 200, { z: 3, label: 'Store' }),
      ]);
      await page.evaluate(
        ([root, at]) =>
          (window as unknown as { __bava: { fakes: { harness: { setSource(root: string, path: string, source: string): void } } } }).__bava.fakes.harness.setSource(
            root,
            at,
            '# Architecture\n\n<!-- bava: embed=f1 -->\n![Write path](../.bava/attachments/Architecture%20-%20Write%20path.png)\n',
          ),
        [SPACE, CANVAS_PAGE] as const,
      );
      await openPage(page, CANVAS_PAGE);
      await menu(page, 'view.document');
      const picture = editor(page).locator('figure.embed img');
      await expect(picture).toHaveAttribute('src', /^blob:/);
      await expect.poll(() => picture.evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'embed', 'own-size', theme));
    });
  });

  test.describe(`a page's tags, ${theme}`, () => {
    test('adding one: what is typed, and the Space\'s tags it may be', async ({ page }) => {
      await openDocument(page, theme, 'Marketing/Launch plan.md');
      const tags = documentPane(page).getByRole('group', { name: 'Tags' });
      await tags.getByRole('button', { name: 'Add tag' }).click();
      await page.keyboard.type('Ro');
      const choices = tags.getByRole('listbox');
      await expect(choices.getByRole('option')).toHaveText(['road-map', 'Add "ro"']);
      await restPointer(page);
      await shotFloating(page, tags, choices, shot('document', 'tags', 'adding', theme));
    });
  });

  // Each sheet in a window tall enough to hold its page whole.
  test.describe(`the Document's sheets, ${theme}`, () => {
    test.use({ viewport: { width: 1280, height: 2600 } });

    for (const sheet of [...Object.keys(DOC_SHEETS), 'errors', 'empty'] as DocSheet[]) {
      test(sheet, async ({ page }) => {
        const { markdown, ready } = sheetPage(sheet);
        await openSeeded(page, theme, markdown);
        for (const each of ready) await expect(editor(page).locator(each).first()).toBeVisible();
        await imagesLoaded(editor(page));
        await restPointer(page);
        await shotPane(documentPane(page), shot('document', 'sheet', sheet, theme));
      });
    }
  });

  test.describe(`the Document's selections, ${theme}`, () => {
    // A node selected ringed as one: a block, an inline piece, a rule.
    for (const [name, how] of [
      ['image', 'down'],
      ['divider', 'down'],
      ['inline-equation', 'right'],
    ] as const) {
      test(`${name} selected`, async ({ page }) => {
        const subject: Subject = SUBJECTS[name];
        await openSeeded(page, theme, subject.markdown);
        const target = editor(page).locator(subject.target ?? subject.find).first();
        await expect(target).toBeVisible();
        await imagesLoaded(editor(page));
        await selectNode(page, how, name === 'inline-equation' ? 'The area is '.length : 0);
        await expect(target).toHaveClass(/ProseMirror-selectednode/);
        await restPointer(page);
        await shotPane(documentPane(page), shot('document', name, 'selected', theme));
      });
    }

    test("a code block's caption being edited", async ({ page }) => {
      await openSeeded(page, theme, SUBJECTS.code.markdown);
      const caption = editor(page).locator('.code-block .code-caption').first();
      await caption.click();
      await expect(caption).toBeFocused();
      await restPointer(page);
      await shotPane(documentPane(page), shot('document', 'code', 'caption-editing', theme));
    });
  });
}

/**
 * Selects a node by keys, as a person reaches one: ArrowDown onto it from the
 * end of the line before, or ArrowRight onto it from the start of its line,
 * `lead` characters in.
 */
async function selectNode(page: Page, how: 'down' | 'right', lead: number) {
  if (how === 'down') {
    await caretOnWord(page, 'Before');
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowDown');
    return;
  }
  await caretAtStart(page, editor(page).locator(':scope > p:nth-child(2)'));
  for (let i = 0; i < lead; i += 1) await page.keyboard.press('ArrowRight');
  // The editor reads where the browser's own moves left the caret a moment
  // later; a key onto an inline piece before then acts on where it was.
  await personPace(page);
  await page.keyboard.press('ArrowRight');
}
