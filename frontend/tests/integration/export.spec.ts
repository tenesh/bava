import { expect, test, type Page } from '@playwright/test';
import { SPACE, editor, menu, menus, openApp, openLoosePage, openPage, openSpace, rightClick, sidePane, statusMessage } from '../helpers';

// Export as a Markdown zip, from each way in: File ▸ Export, a page's or a
// folder's right-click, the page's menu, the Space switcher. What was
// written is read back from the stand-in.

type Zip = { out: string; scope: { kind: string; path: string; attachments: string[] }; files: string[] };
const zips = (page: Page) => page.evaluate(() => (window as unknown as { __bava: { fakes: { harness: { zips: Zip[] } } } }).__bava.fakes.harness.zips);
const pageDialog = (page: Page) => page.getByRole('dialog', { name: 'Export page' });
const spaceDialog = (page: Page) => page.getByRole('dialog', { name: 'Export Space' });
const asZip = (page: Page) => pageDialog(page).locator('[data-part="item"]', { hasText: 'Markdown zip' }).click();

type Pdf = { root: string; out: string; request: { document: { html: string; widthPx: number } | null; canvas: { svg: string } | null; setup: { paper: string; landscape: boolean }; dark: boolean; numbers: boolean } };
type SpacePdf = { root: string; out: string; request: { title: string; entries: { title: string; path: string; folder: boolean; depth: number; document: { html: string } | null }[] } };
const spacePdfs = (page: Page) => page.evaluate(() => (window as unknown as { __bava: { fakes: { harness: { spacePdfs: SpacePdf[] } } } }).__bava.fakes.harness.spacePdfs);
const fault = (page: Page, faults: Record<string, unknown>) =>
  page.evaluate((f) => Object.assign((window as unknown as { __bava: { fakes: { harness: { faults: object } } } }).__bava.fakes.harness.faults, f), faults);
const pdfs = (page: Page) => page.evaluate(() => (window as unknown as { __bava: { fakes: { harness: { pdfs: Pdf[] } } } }).__bava.fakes.harness.pdfs);

test.describe('export as a Markdown zip', () => {
  test('File ▸ Export ▸ Page shows what the zip holds and writes it', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Marketing/Launch plan.md');
    await menu(page, 'file.exportPage');
    await asZip(page);
    await expect(pageDialog(page)).toContainText('Launch plan');
    await expect(pageDialog(page)).toContainText('1 page');
    await pageDialog(page).getByRole('button', { name: 'Export zip' }).click();
    await expect(pageDialog(page)).toHaveCount(0);
    await expect.poll(async () => (await zips(page)).length).toBe(1);
    const [zip] = await zips(page);
    expect(zip.out).toMatch(/Launch plan\.zip$/);
    expect(zip.scope).toMatchObject({ kind: 'page', path: 'Marketing/Launch plan.md' });
    expect(zip.files).toContain('Marketing/Launch plan.md');
  });

  test("a folder's right-click exports that folder, its pages at their place", async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await rightClick(page, sidePane(page).locator('[data-path="Marketing"]'));
    await menus(page).getByRole('menuitem', { name: 'Export' }).click();
    await spaceDialog(page).locator('[data-part="item"]', { hasText: 'Markdown zip' }).click();
    await expect(spaceDialog(page)).toContainText('Brand guide');
    await expect(spaceDialog(page)).not.toContainText('Roadmap');
    await spaceDialog(page).getByRole('button', { name: 'Export zip' }).click();
    await expect.poll(async () => (await zips(page)).length).toBe(1);
    const [zip] = await zips(page);
    expect(zip.out).toMatch(/Marketing\.zip$/);
    expect(zip.files.every((f) => f.startsWith('Marketing/') || f.startsWith('.bava/attachments/'))).toBe(true);
  });

  test("a Space's PDF says it prints, and Cancel writes none", async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await fault(page, { slowPrint: 1500 });
    await menu(page, 'file.exportSpace');
    await expect(spaceDialog(page).getByRole('button', { name: 'Export PDF' })).toBeEnabled();
    await spaceDialog(page).getByRole('button', { name: 'Export PDF' }).click();
    await expect(spaceDialog(page)).toContainText('Printing');
    await spaceDialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(spaceDialog(page)).toHaveCount(0);
    await expect(statusMessage(page)).toContainText('Export cancelled. No PDF was written.');
    expect(await spacePdfs(page)).toEqual([]);
  });

  test('a zip being written counts its files, and Cancel writes none', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await fault(page, { slowZip: 300 });
    await menu(page, 'file.exportSpace');
    await spaceDialog(page).locator('[data-part="item"]', { hasText: 'Markdown zip' }).click();
    await spaceDialog(page).getByRole('button', { name: 'Export zip' }).click();
    await expect(spaceDialog(page)).toContainText('Writing');
    await expect(spaceDialog(page).getByRole('button', { name: 'Export zip' })).toBeDisabled();
    await spaceDialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(spaceDialog(page)).toHaveCount(0);
    await expect(statusMessage(page)).toContainText('Export cancelled. No zip was written.');
    expect(await zips(page)).toEqual([]);
  });

  test("a page's right-click and its page menu open the page's export", async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Roadmap.md');
    await rightClick(page, sidePane(page).locator('[data-path="Roadmap.md"]'));
    await menus(page).getByRole('menuitem', { name: 'Export' }).click();
    await expect(pageDialog(page)).toContainText('Roadmap');
    await pageDialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(pageDialog(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Page menu' }).click();
    await menus(page).getByRole('menuitem', { name: 'Export' }).click();
    await expect(pageDialog(page)).toContainText('Roadmap');
  });

  test('the Space switcher exports the whole Space, with its templates and settings', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await page.locator('.bava-space-switcher').click();
    await page.getByRole('menuitem', { name: 'Export Space' }).click();
    await spaceDialog(page).locator('[data-part="item"]', { hasText: 'Markdown zip' }).click();
    await expect(spaceDialog(page)).toContainText('Settings');
    await expect(spaceDialog(page)).toContainText('templates');
    await spaceDialog(page).getByRole('button', { name: 'Export zip' }).click();
    await expect.poll(async () => (await zips(page)).length).toBe(1);
    const [zip] = await zips(page);
    expect(zip.scope.kind).toBe('space');
    expect(zip.files).toContain('.bava/space.json');
  });

  // A PDF needs no Space: the page's folder is open for its pictures.
  test('a page on its own exports as a PDF, with no zip offered', async ({ page }) => {
    await openApp(page, 'light');
    await openLoosePage(page);
    await menu(page, 'file.exportPage');
    await expect(pageDialog(page).locator('[data-part="item"]', { hasText: 'Markdown zip' })).toHaveCount(0);
    await pageDialog(page).getByRole('button', { name: 'Export PDF' }).click();
    await expect.poll(async () => (await pdfs(page)).length).toBe(1);
    const [pdf] = await pdfs(page);
    expect(pdf.root).toBe('/Users/you/Documents');
    expect(pdf.out).toMatch(/Notes\.pdf$/);
    expect(pdf.request.document?.html).toContain('A page kept on its own');
  });

  test('File ▸ Export ▸ Page prints the page to a PDF, as the dialog set it', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Marketing/Launch plan.md');
    await menu(page, 'file.exportPage');
    const dialog = pageDialog(page);
    await expect(dialog.frameLocator('iframe').locator('h1').first()).toContainText('Launch plan');
    await dialog.locator('[data-part="item"]', { hasText: 'Landscape' }).click();
    await dialog.locator('[data-part="item"]', { hasText: 'Dark' }).click();
    await dialog.locator('label', { hasText: 'Page numbers' }).click();
    await dialog.getByRole('button', { name: 'Export PDF' }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await pdfs(page)).length).toBe(1);
    const [pdf] = await pdfs(page);
    expect(pdf.out).toMatch(/Launch plan\.pdf$/);
    expect(pdf.request).toMatchObject({ dark: true, numbers: true, setup: { landscape: true }, canvas: null });
    expect(pdf.request.document?.html).toContain('bava-print');
    expect(pdf.request.document?.html).not.toContain('contenteditable');
    await expect(statusMessage(page)).toHaveText('Exported Launch plan.pdf');
  });

  // A zip holds the files as saved: the open page's last words are saved first.
  test('an unsaved page is saved before it is exported', async ({ page }) => {
    await openApp(page, 'light');
    await openPage(page, 'Roadmap.md');
    await editor(page).locator('h1').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' for Q4');
    await menu(page, 'file.exportPage');
    await expect(pageDialog(page)).toBeVisible();
    const saved = await page.evaluate(
      async (root) => (await (window as unknown as { __bava: { fakes: { SpaceService: { Index(r: string, t: boolean): Promise<{ pages: { path: string; text: string }[] }> } } } }).__bava.fakes.SpaceService.Index(root, true)).pages.find((p) => p.path === 'Roadmap.md')?.text,
      SPACE,
    );
    expect(saved).toContain('Roadmap for Q4');
  });
});

test.describe('export a folder or the Space as one PDF', () => {
  test('the Space switcher prints every page, folders before their pages, as one PDF', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await page.locator('.bava-space-switcher').click();
    await page.getByRole('menuitem', { name: 'Export Space' }).click();
    const dialog = spaceDialog(page);
    await expect(dialog.frameLocator('iframe').locator('.bava-print')).toBeVisible();
    await dialog.getByRole('button', { name: 'Export PDF' }).click();
    await expect.poll(async () => (await spacePdfs(page)).length).toBe(1);
    const [pdf] = await spacePdfs(page);
    expect(pdf.out).toMatch(/\.pdf$/);
    const entries = pdf.request.entries;
    const marketing = entries.findIndex((e) => e.folder && e.path === 'Marketing');
    const launch = entries.findIndex((e) => e.path === 'Marketing/Launch plan.md');
    expect(marketing).toBeGreaterThanOrEqual(0);
    expect(launch).toBeGreaterThan(marketing);
    expect(entries.filter((e) => !e.folder).every((e) => e.document?.html.includes('bava-print'))).toBe(true);
    await expect(statusMessage(page)).toContainText('Exported');
  });

  test("a folder's right-click prints only that folder, titled with its name", async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await rightClick(page, sidePane(page).locator('[data-path="Marketing"]'));
    await menus(page).getByRole('menuitem', { name: 'Export' }).click();
    await spaceDialog(page).getByRole('button', { name: 'Export PDF' }).click();
    await expect.poll(async () => (await spacePdfs(page)).length).toBe(1);
    const [pdf] = await spacePdfs(page);
    expect(pdf.request.title).toBe('Marketing');
    expect(pdf.out).toMatch(/Marketing\.pdf$/);
    expect(pdf.request.entries.every((e) => e.path.startsWith('Marketing/'))).toBe(true);
    expect(pdf.request.entries[0].depth).toBe(0);
  });

  test('a page that cannot be read stops the PDF and is named', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await fault(page, { unreadable: 'Marketing/Brand guide.md' });
    await rightClick(page, sidePane(page).locator('[data-path="Marketing"]'));
    await menus(page).getByRole('menuitem', { name: 'Export' }).click();
    await spaceDialog(page).getByRole('button', { name: 'Export PDF' }).click();
    await expect(statusMessage(page)).toHaveText('Brand guide could not be read, so no PDF was made.');
    expect(await spacePdfs(page)).toHaveLength(0);
  });

  test('a page the system cannot print stops the PDF, named, with why', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await fault(page, { unprintable: 'Marketing/Launch plan.md' });
    await rightClick(page, sidePane(page).locator('[data-path="Marketing"]'));
    await menus(page).getByRole('menuitem', { name: 'Export' }).click();
    await spaceDialog(page).getByRole('button', { name: 'Export PDF' }).click();
    await expect(statusMessage(page)).toHaveText('Launch plan could not be printed, so no PDF was made: print the Document: the printer jammed');
  });

  test('an import waits until the pages are drawn and printed', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await menu(page, 'file.exportSpace');
    const dialog = spaceDialog(page);
    await expect(dialog.frameLocator('iframe').locator('.bava-print')).toBeVisible();
    await fault(page, { slowOpen: 300 });
    await dialog.getByRole('button', { name: 'Export PDF' }).click();
    await expect(dialog).toContainText('Drawing');
    await menu(page, 'file.importFolder');
    // The picker answers at once in the stand-in: an Import dialog would be up by now.
    await page.waitForTimeout(500);
    await expect(page.getByRole('dialog', { name: 'Import' })).toHaveCount(0);
    await expect(dialog).toContainText('Drawing');
  });

  test('Cancel while the pages are drawn stops it, and nothing is printed', async ({ page }) => {
    await openApp(page, 'light');
    await openSpace(page);
    await page.locator('.bava-space-switcher').click();
    await page.getByRole('menuitem', { name: 'Export Space' }).click();
    const dialog = spaceDialog(page);
    await expect(dialog.frameLocator('iframe').locator('.bava-print')).toBeVisible();
    await fault(page, { slowOpen: 300 });
    await dialog.getByRole('button', { name: 'Export PDF' }).click();
    await expect(dialog).toContainText('Drawing');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    // The rest open at once now: a drawing that went on would print soon.
    await fault(page, { slowOpen: 0 });
    await page.waitForTimeout(1500);
    expect(await spacePdfs(page)).toHaveLength(0);
  });
});
