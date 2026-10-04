import { inflateSync } from 'node:zlib';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { ELEMENT_KINDS, FAMILIES, elementScene, familyOf, kinds, type Kind } from './fixtures/canvas-scenes';
import type { Boot, Faults } from './harness/fake-services';
import { REFERENCE } from './harness/orphans';

// Every helper the walks share. A spec defines none of its own.

export type Theme = 'light' | 'dark';
export const THEMES: Theme[] = ['light', 'dark'];

type Harness = { __bava: { menu(id: string): void }; _wails: { dispatchWailsEvent(event: { name: string; data: unknown }): void } };

/**
 * A person's pace: how long a person takes, at the least, between seeing
 * something appear and acting on it. Two things in the app wait about that
 * long and show nothing on the page when they are ready: Ark's floating
 * pieces and dialogs start listening for a press outside them, and for
 * Escape, a moment after they open; and the page editor reads a click's selection a moment after the browser
 * shows it. A step that follows one of them pauses this long first; anything
 * the page does show is waited for instead.
 */
const PERSON_PACE_MS = 250;

/** Pauses for a person's pace (see `PERSON_PACE_MS`). */
export const personPace = (page: Page) => page.waitForTimeout(PERSON_PACE_MS);

// ---- the app -----------------------------------------------------------------

/** The moment every walk's clock starts at. */
const NOW = new Date('2026-09-27T12:00:00Z');

/**
 * Loads the harness page in a theme, with saved storage and how the Go side
 * starts (`Boot`), and waits for the theme and fonts. The splash may still
 * be showing.
 */
async function loadApp(page: Page, theme: Theme, storage: Record<string, string>, boot: Boot) {
  await page.addInitScript(
    ([seed, chosen, start]) => {
      for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
      localStorage.setItem('bava.theme', chosen);
      (window as unknown as { __bavaBoot: Boot }).__bavaBoot = start;
    },
    [storage, theme, boot] as const,
  );
  // A fixed clock: the Trash says "Today" and dates, which would otherwise
  // change the pictures with the calendar.
  await page.clock.install({ time: NOW });
  if (boot.holdSettings) {
    // Time stands still: the splash's backstop would otherwise lift it.
    await page.clock.pauseAt(NOW);
  }
  await page.goto('/tests/harness/index.html');
}

/** Opens the app on the harness page, in a theme, and waits for it to settle. */
export async function openApp(page: Page, theme: Theme, storage: Record<string, string> = {}, boot: Boot = {}) {
  await loadApp(page, theme, storage, boot);
  await expect(page.locator('[data-part="splash"]')).toHaveCount(0, { timeout: 15_000 });
  // The first page a fresh server serves is slow to build; later ones are quick.
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** The app as it starts, its settings never answering, so the splash stays over it. */
export async function openAtLaunch(page: Page, theme: Theme) {
  await loadApp(page, theme, {}, { holdSettings: true });
  await expect(page.locator('[data-part="splash"]')).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

type FaultHarness = { __bava: { fakes: { harness: { faults: Faults } } } };

/** Makes the Go side fail one way from now on (`Faults`). */
export async function fault<K extends keyof Faults>(page: Page, name: K, value: Faults[K]) {
  await page.evaluate(([key, to]) => Object.assign((window as unknown as FaultHarness).__bava.fakes.harness.faults, { [key]: to }), [name, value] as const);
}

/** A native menu command, as Go delivers it. */
export async function menu(page: Page, id: string) {
  await page.evaluate((command) => (window as unknown as Harness).__bava.menu(command), id);
}

/** An event from Go, such as an unexpected error. */
export async function emit(page: Page, name: string, data: unknown) {
  await page.evaluate(([event, payload]) => (window as unknown as Harness)._wails.dispatchWailsEvent({ name: event, data: payload }), [name, data] as const);
}

/** The pretend Space's folder, as the fixtures root it, and the folder it is in. */
export const SPACE = '/Users/you/Documents/Acme Product';
export const PARENT = '/Users/you/Documents';

type SpaceHarness = { __bava: { fakes: { SpaceService: { Create(parent: string, name: string): Promise<unknown> } } } };

type LooseHarness = { __bava: { fakes: { harness: { fileToOpen: string } } } };

/** Opens the page kept on its own, in no Space, as Open File would. */
export async function openLoosePage(page: Page) {
  await page.evaluate((path) => Object.assign((window as unknown as LooseHarness).__bava.fakes.harness, { fileToOpen: path }), `${PARENT}/Notes.md`);
  await menu(page, 'file.open');
  await expect(page.locator('header')).toContainText('Notes');
}

/** New Space, from the Space switcher of the Space open now. */
export async function newSpaceFromSwitcher(page: Page) {
  await page.locator('.bava-space-switcher').click();
  await menus(page).getByRole('menuitem', { name: 'New Space' }).click();
  await expect(openDialog(page)).toBeVisible();
}

/** Makes another Space beside the pretend one, as New Space would have before. */
export async function anotherSpace(page: Page, name: string) {
  await page.evaluate(([parent, called]) => (window as unknown as SpaceHarness).__bava.fakes.SpaceService.Create(parent, called), [PARENT, name] as const);
}

/** Opens the seeded Space, as Open Space would. */
export async function openSpace(page: Page) {
  await menu(page, 'file.openSpace');
  await expect(page.locator('[data-path="Roadmap.md"]')).toBeVisible();
}

/** The folder a page of the pretend Space is in, '' at the top. */
const folderOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

/** Opens a page from the tree, opening its folder first. */
export async function openPage(page: Page, path: string) {
  await openSpace(page);
  const row = page.locator(`[data-path="${path}"]`);
  if (!(await row.isVisible())) await page.locator(`[data-path="${folderOf(path)}"]`).click();
  await row.click();
  await expect(page.locator('header')).toContainText(path.split('/').pop()!.replace(/\.md$/, ''));
}

/** Empties the pretend Space's Trash, as Empty Trash does. */
export async function emptyTrash(page: Page) {
  await page.evaluate((root) => {
    const fakes = (window as unknown as { __bava: { fakes: { SpaceService: { Apply(root: string, op: object): Promise<unknown> } } } }).__bava.fakes;
    return fakes.SpaceService.Apply(root, { kind: 'emptyTrash', path: '', folder: '', name: '', index: -1, id: '', width: '' });
  }, SPACE);
}

// ---- what is on screen -----------------------------------------------------------

/** The side pane: the Files tree and Media. */
export const sidePane = (page: Page) => page.locator('.region-files');

/** The Document's pane, and the page editor in it. */
export const documentPane = (page: Page) => page.locator('[data-side="document"]');
export const editor = (page: Page) => page.locator('.bava-doc');

/** The Canvas's pane, and its drawing surface. */
export const canvasPane = (page: Page) => page.locator("[data-side='canvas']");
export const canvasHost = (page: Page) => page.locator("[data-side='canvas'] .konvajs-content");

/**
 * The status bar, and the passing message it shows: found by its look, not
 * its role, as an open dialog hides everything behind it from roles.
 */
export const statusBar = (page: Page) => page.locator('footer.status');
export const statusMessage = (page: Page) => statusBar(page).locator('.message');

/** The dialog that is open now. */
export const openDialog = (page: Page) => page.locator('.bava-dialog-content').filter({ visible: true });

/** Every menu showing: a menu, and any submenu open from it. */
export const menus = (page: Page) => page.locator('.bava-menu').filter({ visible: true });

/** The canvas toolbar's picker that is open now. */
export const popovers = (page: Page) => page.locator('.bava-control-popover, .bava-style-popover').filter({ visible: true });

/**
 * The tooltips open now. One just left can still be drawn for a moment as it
 * closes (`data-state="closed"`), so only open ones count.
 */
export const tooltips = (page: Page) => page.locator('.bava-tooltip[data-state="open"]').filter({ visible: true });

/** Every tooltip drawn, open or still closing. */
const drawnTooltips = (page: Page) => page.locator('.bava-tooltip').filter({ visible: true });

/** Waits for every image in `within` to be drawn: one still loading paints late. */
export async function imagesLoaded(within: Locator) {
  await expect.poll(() => within.locator('img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete))).toBe(true);
}

/** Nothing covers the window: no dialog shows unless one was opened. */
export async function expectNothingCovering(page: Page) {
  for (const selector of ['.bava-dialog-content', '.bava-dialog-backdrop', '.bava-menu', '.bava-control-popover']) {
    await expect(page.locator(selector).filter({ visible: true }), `${selector} shows with nothing opened`).toHaveCount(0);
  }
}

// ---- pictures ------------------------------------------------------------------

/**
 * The name a reference is kept under: area/screen--state--theme. It is
 * recorded on the test, so a full run can list the references none compared.
 */
export function shot(area: string, screen: string, state: string, theme: Theme) {
  const name = [area, `${screen}--${state}--${theme}.png`];
  test.info().annotations.push({ type: REFERENCE, description: name.join('/') });
  return name;
}

/**
 * The pointer moved off everything, to the window's corner, so nothing in a
 * picture shows as hovered; a tooltip waiting to open is dropped as the
 * pointer leaves its control.
 */
export async function restPointer(page: Page) {
  await page.mouse.move(0, 0);
  await expect(drawnTooltips(page)).toHaveCount(0);
}

/** A picture of one pane, or any part of the window a locator names. */
export async function shotPane(pane: Locator, name: string[]) {
  await expect(pane).toBeVisible();
  await expect(pane).toHaveScreenshot(name);
}

/** A picture of the dialog that is open now, or of `dialog` when given. */
export async function shotDialog(page: Page, name: string[], dialog: Locator = openDialog(page)) {
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveScreenshot(name);
}

/**
 * Waits for something floating to be placed: Ark shows a floating piece
 * above the window, then moves it beside what it floats from a moment later.
 * A click or a measurement before then lands where it no longer is.
 */
export async function placed(floating: Locator) {
  await expect(floating.first()).toBeVisible();
  let before = '';
  await expect
    .poll(async () => {
      const boxes = await Promise.all((await floating.all()).map((part) => part.boundingBox()));
      const now = JSON.stringify(boxes);
      const still = now === before && boxes.every((box) => box !== null && box.y >= 0 && box.x >= 0);
      before = now;
      return still;
    })
    .toBe(true);
}

/** Room round a floating piece for its shadow. */
const SHADOW = 16;

/**
 * A picture of something floating (a menu, a picker, a card) and what it
 * floats from: the smallest part of the window holding both, with room for
 * the shadow. `floating` may match several (a menu and its submenu).
 *
 * In the gallery, the picture holds the whole cell the anchor sits in,
 * caption and all, and every other cell is hidden while it is taken, so no
 * neighbour shows at the edges or beside a piece that floats over it.
 */
export async function shotFloating(page: Page, anchor: Locator | null, floating: Locator, name: string[]) {
  await placed(floating);
  const parts = [...(anchor ? await anchor.all() : []), ...(await floating.all())];
  const marked = await markPictured(parts);
  try {
    const cells = await page.locator('[data-pictured]').all();
    const boxes = (await Promise.all([...parts, ...cells].map((part) => part.boundingBox()))).filter((box) => box !== null);
    const view = page.viewportSize()!;
    const left = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.x)) - SHADOW));
    const top = Math.max(0, Math.floor(Math.min(...boxes.map((box) => box.y)) - SHADOW));
    const right = Math.min(view.width, Math.ceil(Math.max(...boxes.map((box) => box.x + box.width)) + SHADOW));
    const bottom = Math.min(view.height, Math.ceil(Math.max(...boxes.map((box) => box.y + box.height)) + SHADOW));
    await expect(page).toHaveScreenshot(name, { clip: { x: left, y: top, width: right - left, height: bottom - top } });
  } finally {
    if (marked) await page.locator('[data-pictured]').evaluateAll((cells) => cells.forEach((cell) => cell.removeAttribute('data-pictured')));
  }
}

/**
 * Marks the gallery cells holding `parts` as the ones pictured (the gallery
 * hides the rest while any is marked). Whether any was: outside the gallery,
 * or with the whole gallery as the anchor, none is.
 */
async function markPictured(parts: Locator[]) {
  let marked = false;
  for (const part of parts) {
    const cell = await part.evaluate((element) => {
      const found = element.closest('[data-cell]');
      found?.setAttribute('data-pictured', '');
      return found !== null;
    });
    marked ||= cell;
  }
  return marked;
}

// ---- the Document ----------------------------------------------------------------

/** Opens a page in the Document view. */
export async function openDocument(page: Page, theme: Theme, path: string) {
  await openApp(page, theme);
  await openPage(page, path);
  await menu(page, 'view.document');
  await expect(editor(page)).toBeVisible();
}

/**
 * Scrolls a block to the middle of its pane, so a menu opened from it opens
 * the same way every run: a pointer's hover scrolls only as far as it must,
 * which leaves the block wherever the last scroll did.
 */
export async function centreInView(block: Locator) {
  // Centred again until it stays put: an image above that finishes loading
  // after the first scroll moves the block, and a menu opened from it then
  // opens the other way.
  let before = '';
  await expect
    .poll(async () => {
      const now = await block.evaluate((element) => {
        element.scrollIntoView({ block: 'center' });
        const loaded = [...document.images].every((image) => image.complete);
        const box = element.getBoundingClientRect();
        return loaded ? `${box.x},${box.y}` : 'loading';
      });
      const still = now !== 'loading' && now === before;
      before = now;
      return still;
    })
    .toBe(true);
}

/** Puts the caret on the empty line the page always ends with. */
export async function newLineAtEnd(page: Page) {
  const last = editor(page).locator('p').last();
  await expect(last).toHaveText('');
  await last.click();
  // The editor settles the click's own caret just after the mouse is
  // released, so it is read until it holds on that line.
  await expect
    .poll(() =>
      last.evaluate((p) => {
        const selection = document.getSelection()!;
        return selection.isCollapsed && p.contains(selection.anchorNode);
      }),
    )
    .toBe(true);
}

/** The empty page of the pretend Space that walks seeding their own words open. */
export const SEEDED_PAGE = 'Marketing/Press release.md';

type DocumentHarness = { __bava: { fakes: { harness: { setSource(root: string, path: string, source: string): void } } } };

/** Opens a page in the Document view with Markdown put into it first, so the Files tree stays as it is. */
export async function openSeeded(page: Page, theme: Theme, markdown: string) {
  await openApp(page, theme);
  await page.evaluate(
    ([root, at, source]) => (window as unknown as DocumentHarness).__bava.fakes.harness.setSource(root, at, source),
    [SPACE, SEEDED_PAGE, markdown] as const,
  );
  await openPage(page, SEEDED_PAGE);
  await menu(page, 'view.document');
  await expect(editor(page)).toBeVisible();
}

/** The formatting bubble. */
export const formatBubble = (page: Page) => page.getByRole('toolbar', { name: 'Formatting' });

/** The block handle beside the block under the pointer: its add button and its grip. */
export const blockHandle = (page: Page) => page.getByRole('button', { name: 'Drag, or open the block menu' }).locator('..');

/** Where a word of the page is on screen: the middle of its first appearance. */
async function wordAt(page: Page, word: string) {
  const at = await page.evaluate((w) => {
    const walker = document.createTreeWalker(document.querySelector('.bava-doc')!, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const found = node.textContent!.indexOf(w);
      if (found < 0) continue;
      const range = document.createRange();
      range.setStart(node, found);
      range.setEnd(node, found + w.length);
      const r = range.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  }, word);
  expect(at, `"${word}" is on the page`).not.toBeNull();
  return at!;
}

/** Puts the caret in a word of the page with a click, and waits for the editor to have read it. */
export async function caretOnWord(page: Page, word: string) {
  const at = await wordAt(page, word);
  await page.mouse.click(at.x, at.y);
  await expect
    .poll(() =>
      page.evaluate((w) => {
        const selection = document.getSelection()!;
        return selection.isCollapsed && (selection.anchorNode?.textContent ?? '').includes(w);
      }, word),
    )
    .toBe(true);
  // Keys pressed before the editor has read the click act on the selection before it.
  await personPace(page);
}

/** Puts the caret at the start of a line of the page, as a click on its start would. */
export async function caretAtStart(page: Page, line: Locator) {
  const box = (await line.boundingBox())!;
  await page.mouse.click(box.x + 1, box.y + box.height / 2);
  await expect
    .poll(() =>
      line.evaluate((element) => {
        const selection = document.getSelection()!;
        if (!selection.isCollapsed || !element.contains(selection.anchorNode)) return false;
        const before = document.createRange();
        before.setStart(element, 0);
        before.setEnd(selection.anchorNode!, selection.anchorOffset);
        return before.toString() === '';
      }),
    )
    .toBe(true);
  await personPace(page);
}

/**
 * A picture of blocks of the page and anything showing with them (`parts`
 * may match several: a block, its handle, a field or the bubble), with room
 * round them.
 */
export async function shotBlock(page: Page, parts: Locator, name: string[]) {
  await shotFloating(page, null, parts, name);
}

/**
 * `parts`, and any line of the page's text a picture of them would cut in
 * two: one reaching into the room left round them for a shadow. A field
 * floating under a block can leave that room over the next line.
 */
export async function withWholeLines(page: Page, parts: Locator): Promise<Locator> {
  await placed(parts);
  const boxes = (await Promise.all((await parts.all()).map((part) => part.boundingBox()))).filter((box) => box !== null);
  const top = Math.min(...boxes.map((box) => box.y)) - SHADOW;
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) + SHADOW;
  let whole = parts;
  for (const line of await editor(page).locator('p').all()) {
    const box = await line.boundingBox();
    if (!box) continue;
    const cutBelow = box.y < bottom && box.y + box.height > bottom;
    const cutAbove = box.y < top && box.y + box.height > top;
    if (cutBelow || cutAbove) whole = whole.or(line);
  }
  return whole;
}

/** Clicks the table cell holding `text`, and waits for the caret to settle in it. */
export async function caretInCell(page: Page, text: string) {
  await editor(page).getByText(text, { exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => document.getSelection()?.anchorNode?.parentElement?.closest('td, th')?.textContent ?? ''))
    .toBe(text);
  // Keys pressed before the editor has read the click, as no person presses
  // them, would act on the selection before it.
  await personPace(page);
}

/** Drags across table cells, from the one holding `from` to the one holding `to`. */
export async function dragCells(page: Page, from: string, to: string) {
  // Positions are read once the page's fonts have settled.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const start = (await editor(page).getByText(from, { exact: true }).first().boundingBox())!;
  const end = (await editor(page).getByText(to, { exact: true }).first().boundingBox())!;
  await page.mouse.move(start.x + 4, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + 4, end.y + end.height / 2, { steps: 8 });
  await page.mouse.up();
}

/** A right-click on the table cell holding `text`, or on the element given. */
export async function rightClick(page: Page, target: string | Locator) {
  // As a person would: once any menu open before has closed.
  await expect(menus(page)).toHaveCount(0);
  const where = typeof target === 'string' ? editor(page).getByText(target, { exact: true }).first() : target;
  const box = (await where.boundingBox())!;
  await page.mouse.click(box.x + 4, box.y + box.height / 2, { button: 'right' });
  await expect(menus(page)).toBeVisible();
}

/**
 * Selects one word of the page, as a double-click on it would, and waits for
 * the page to hold exactly it. The double-click lands on the word's own
 * middle, measured from its text, wherever the line wraps.
 */
export async function selectWord(page: Page, word: string) {
  const box = await wordAt(page, word);
  // Held as a person's is: pressed and released in the same instant, it can
  // select nothing under load.
  await page.mouse.dblclick(box.x, box.y, { delay: 50 });
  await expect.poll(() => page.evaluate(() => document.getSelection()?.toString().trim())).toBe(word);
  // The editor reads the browser's selection a moment later; the formatting
  // bubble shows once it has, and keys pressed before then act on none.
  await expect(page.getByRole('toolbar', { name: 'Formatting' })).toBeVisible();
}

/** A click somewhere else: on the page's title, or on the status bar, outside the page. */
export async function clickAway(page: Page, where: 'page' | 'outside') {
  // Not in the same instant the thing appeared: before Ark's pieces listen
  // for a press outside them.
  await personPace(page);
  const target = where === 'page' ? editor(page).locator('h1').first() : page.locator('footer').first();
  const box = (await target.boundingBox())!;
  await page.mouse.click(box.x + Math.min(40, box.width / 2), box.y + box.height / 2);
}

// ---- the canvas ------------------------------------------------------------------

/** The page every canvas walk seeds and opens. */
export const CANVAS_PAGE = 'Engineering/Architecture.md';

export type Point = { x: number; y: number };
export type Modifier = 'Shift' | 'Alt' | 'Control';
/** An element as the saved scene holds it. */
export type Saved = Record<string, unknown> & { id: string; type: string; x: number; y: number; w: number; h: number };

type CanvasHarness = {
  __bava: {
    fakes: {
      harness: {
        setScene(root: string, path: string, scene: { version: number; elements: unknown[] }): void;
        scene(root: string, path: string): { version: number; elements: Record<string, unknown>[] } | undefined;
        exports: { path: string; contentsBase64: string }[];
      };
    };
  };
};

/** Puts a scene into a page of the pretend Space, before the page is opened. */
export async function seedScene(page: Page, path: string, elements: unknown[]) {
  await page.evaluate(
    ([root, at, list]) => (window as unknown as CanvasHarness).__bava.fakes.harness.setScene(root, at, { version: 1, elements: list }),
    [SPACE, path, elements] as const,
  );
}

/** Opens a page in the Canvas view with a scene put into it first. */
export async function openCanvas(page: Page, theme: Theme, path: string, elements: unknown[]) {
  await openApp(page, theme);
  await seedScene(page, path, elements);
  await openPage(page, path);
  await menu(page, 'view.canvas');
  await expect(canvasHost(page)).toBeVisible();
}

/** The canvas page opened on one of each kind (`kinds`); returns a point on each. */
export async function openKinds(page: Page, theme: Theme) {
  const scene = kinds();
  await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
  return scene.click;
}

/** The canvas page opened at actual size, in light, holding `elements`, and ready for keys. */
export async function startCanvas(page: Page, elements: unknown[] = []) {
  await openCanvas(page, 'light', CANVAS_PAGE, elements);
  await zoomSteps(page, 0);
  // Keys reach the canvas once it has been clicked, as a person's would.
  await clickScene(page, { x: 900, y: 560 });
}

/** Saves the page, then the scene as the file now holds it. */
export async function savedScene(page: Page, path: string) {
  await menu(page, 'file.save');
  await expect(page.locator('header .state')).toHaveText('saved');
  return page.evaluate(([root, at]) => (window as unknown as CanvasHarness).__bava.fakes.harness.scene(root, at), [SPACE, path] as const);
}

/** Every element of the canvas page's saved scene. */
export async function saved(page: Page): Promise<Saved[]> {
  const scene = await savedScene(page, CANVAS_PAGE);
  return scene!.elements as Saved[];
}

export const ofType = (elements: Saved[], type: string) => elements.filter((element) => element.type === type);
export const byId = (elements: Saved[], id: string) => elements.find((element) => element.id === id)!;

/** An element's points on the canvas, its own offset added. */
export function pointsOf(element: Saved): Point[] {
  const points = element.points as number[];
  const out: Point[] = [];
  for (let i = 0; i < points.length; i += 2) out.push({ x: element.x + points[i], y: element.y + points[i + 1] });
  return out;
}

/** An arrow's first and last points on the canvas. */
export function ends(arrow: Saved) {
  const points = pointsOf(arrow);
  return { start: points[0], end: points[points.length - 1] };
}

/** The angle from one point to another, in whole degrees. */
export const angleOf = (from: Point, to: Point) => Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);

/** Every export so far, its bytes as base64. */
export const exportsSoFar = (page: Page) => page.evaluate(() => (window as unknown as CanvasHarness).__bava.fakes.harness.exports);

/**
 * Zooms from 100% by whole steps (×1.2 each, about the canvas's centre):
 * 4 in is 207%, 8 out is 23%. Returns the zoom.
 */
export async function zoomSteps(page: Page, steps: number) {
  await menu(page, 'view.actualSize');
  for (let i = 0; i < Math.abs(steps); i += 1) await menu(page, steps > 0 ? 'view.zoomIn' : 'view.zoomOut');
  return 1.2 ** steps;
}

/** Where the canvas looks after `zoomInto`: its zoom, and a point of the scene held at a point of the screen. */
export type View = { zoom: number; scene: Point; screen: Point };

/**
 * Where a point of the scene is on screen: at a zoom reached by `zoomSteps`
 * from a fresh page, or in a view `zoomInto` set.
 */
export async function onScreen(page: Page, scene: Point, zoom: number | View = 1) {
  if (typeof zoom !== 'number') return { x: zoom.screen.x + (scene.x - zoom.scene.x) * zoom.zoom, y: zoom.screen.y + (scene.y - zoom.scene.y) * zoom.zoom };
  const box = (await canvasHost(page).boundingBox())!;
  const centre = { x: box.width / 2, y: box.height / 2 };
  return { x: box.x + scene.x * zoom + centre.x * (1 - zoom), y: box.y + scene.y * zoom + centre.y * (1 - zoom) };
}

/** Waits for the page to draw a frame, and the next: what the canvas draws on an event shows by then. */
export async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

/**
 * Zooms from 100% by whole steps, then pans, by a wheel in pixels, so a point
 * of the scene sits at the canvas's centre. Returns the view, for
 * `onScreen`, `clickScene`, `dragScene` and `shotRegion`.
 */
export async function zoomInto(page: Page, scene: Point, steps: number): Promise<View> {
  const zoom = await zoomSteps(page, steps);
  const box = (await canvasHost(page).boundingBox())!;
  const screen = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const now = await onScreen(page, scene, zoom);
  await page.mouse.move(screen.x, screen.y);
  // The wheel pans the other way to its delta.
  await page.mouse.wheel(now.x - screen.x, now.y - screen.y);
  await nextFrames(page);
  return { zoom, scene, screen };
}

/**
 * Pans, by a wheel in pixels, so a point of the scene sits just right of the
 * tool rail, at a zoom reached by `zoomSteps` from a fresh page.
 */
export async function bringToCorner(page: Page, scene: Point, zoom: number) {
  const box = (await canvasHost(page).boundingBox())!;
  const now = await onScreen(page, scene, zoom);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // The wheel pans the other way to its delta.
  await page.mouse.wheel(now.x - (box.x + 80), now.y - (box.y + 20));
}

/** A click on a point of the scene, keys held through it. */
export async function clickScene(page: Page, point: Point, options: { button?: 'right'; modifiers?: Modifier[]; zoom?: number | View } = {}) {
  const at = await onScreen(page, point, options.zoom ?? 1);
  for (const key of options.modifiers ?? []) await page.keyboard.down(key);
  await page.mouse.click(at.x, at.y, { button: options.button });
  for (const key of options.modifiers ?? []) await page.keyboard.up(key);
}

/**
 * A drag in scene units, in steps, keys held throughout. With `hold`, the
 * button stays down at the end, for a picture of the drag under way; the walk
 * releases it.
 */
export async function dragScene(page: Page, from: Point, to: Point, options: { modifiers?: Modifier[]; zoom?: number | View; steps?: number; hold?: boolean } = {}) {
  const zoom = options.zoom ?? 1;
  const a = await onScreen(page, from, zoom);
  const b = await onScreen(page, to, zoom);
  for (const key of options.modifiers ?? []) await page.keyboard.down(key);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: options.steps ?? 8 });
  if (options.hold) return;
  await page.mouse.up();
  for (const key of options.modifiers ?? []) await page.keyboard.up(key);
}

/**
 * The eraser taken from empty canvas at `empty` along the middle of each row
 * of a scene's cells, there and back, the button held at the end: everything
 * crossed is marked and faded, and nothing yet gone. `page.mouse.up()`
 * releases it.
 */
export async function eraseAcross(page: Page, scene: { box: { x: number; y: number; w: number; h: number }; cells: Partial<Record<string, { box: { y: number } }>> }, empty: Point) {
  await clickScene(page, empty);
  await page.keyboard.press('e');
  await expect(page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Eraser' })).toHaveAttribute('aria-pressed', 'true');
  const rows = [...new Set(Object.values(scene.cells).map((cell) => cell!.box.y + 90))].sort((a, b) => a - b);
  const [left, right] = [scene.box.x + 5, scene.box.x + scene.box.w - 5];
  await dragScene(page, { x: left, y: rows[0] }, { x: right, y: rows[0] }, { hold: true });
  for (const [row, y] of rows.slice(1).entries()) {
    const [from, to] = row % 2 === 0 ? [right, left] : [left, right];
    for (const point of [{ x: from, y }, { x: to, y }]) {
      const at = await onScreen(page, point);
      await page.mouse.move(at.x, at.y, { steps: 8 });
    }
  }
}

/** Room round a part of the canvas pictured, for a handle or a label that stands out of it. */
const MARGIN = 8;

/**
 * A picture of a part of the canvas, a box of the scene, at a zoom reached by
 * `zoomSteps` or in a view `zoomInto` set, kept inside the canvas's pane.
 */
export async function shotRegion(page: Page, box: { x: number; y: number; w: number; h: number }, name: string[], zoom: number | View = 1) {
  const a = await onScreen(page, { x: box.x, y: box.y }, zoom);
  const b = await onScreen(page, { x: box.x + box.w, y: box.y + box.h }, zoom);
  const pane = (await canvasPane(page).boundingBox())!;
  const left = Math.max(pane.x, Math.floor(a.x - MARGIN));
  const top = Math.max(pane.y, Math.floor(a.y - MARGIN));
  const right = Math.min(pane.x + pane.width, Math.ceil(b.x + MARGIN));
  const bottom = Math.min(pane.y + pane.height, Math.ceil(b.y + MARGIN));
  await expect(page).toHaveScreenshot(name, { clip: { x: left, y: top, width: right - left, height: bottom - top } });
}

/** The cursor the canvas shows where the pointer is, as the page sets it. */
export const canvasCursor = (page: Page) => page.locator("[data-side='canvas'] .canvas-region > .fill").evaluate((host) => (host as HTMLElement).style.cursor);

/** The editor open over a shape's label, an arrow's label or free text. */
export const labelEditor = (page: Page) => page.locator('.bava-label-editor');

/** The editor open over a code block. */
export const codeEditor = (page: Page) => page.locator('.bava-code-editor');

/**
 * Waits for the editor a double-click opens over a kind: CodeMirror over a
 * code block, the label field over anything else, holding the keyboard.
 */
export async function expectEditing(page: Page, kind: Kind) {
  if (ELEMENT_KINDS[kind] === 'code') {
    await expect(codeEditor(page)).toBeVisible();
    await expect(codeEditor(page).locator('.cm-content')).toBeFocused();
  } else {
    await expect(labelEditor(page)).toBeVisible();
    await expect(labelEditor(page)).toBeFocused();
  }
}

/**
 * The canvas page opened, in a theme, on a kind's family of elements
 * (`elementScene`), zoomed four steps in (about 207%) on the kind's cell.
 */
export async function openZoomedOn(page: Page, theme: Theme, kind: Kind) {
  const scene = elementScene(FAMILIES[familyOf(kind)]);
  const cell = scene.cells[kind]!;
  await openCanvas(page, theme, CANVAS_PAGE, scene.elements);
  const view = await zoomInto(page, { x: cell.box.x + cell.box.w / 2, y: cell.box.y + cell.box.h / 2 }, 4);
  return { cell, view };
}

/** The canvas's selection toolbar. */
export const selectionToolbar = (page: Page) => page.getByRole('toolbar', { name: 'Selection' });

/** The tool rail's Select tool. */
export const selectTool = (page: Page) => page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Select' });

/** A short name for a control's label, for a reference's file name. */
export const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A choice from one of the toolbar's pickers, by the control's and the option's names. */
export async function pick(page: Page, control: string, option: string) {
  await selectionToolbar(page).getByRole('button', { name: control, exact: true }).click();
  await placed(popovers(page));
  const swatch = popovers(page).getByTitle(new RegExp(`^${option}$`, 'i'));
  const choice = (await swatch.count()) > 0 ? swatch.first() : popovers(page).locator('.bava-option', { has: page.getByRole('radio', { name: option, exact: true }) });
  await choice.click();
  await expect(choice).toHaveAttribute('data-state', 'checked');
  await page.keyboard.press('Escape');
  await expect(popovers(page)).toHaveCount(0);
}

/** A PNG's width, height and first pixel, from its bytes. */
export function pngFacts(base64: string) {
  const bytes = Buffer.from(base64, 'base64');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const chunks: Buffer[] = [];
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at);
    if (bytes.toString('ascii', at + 4, at + 8) === 'IDAT') chunks.push(bytes.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  // Whatever the first row's filter, its first pixel is stored as it is.
  const raw = inflateSync(Buffer.concat(chunks));
  const [r, g, b, a] = [raw[1], raw[2], raw[3], raw[4]];
  return { width, height, pixel: { r, g, b, a } };
}

/** How light a pixel is, from 0 to 1. */
export const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * The Export dialog over the canvas page as the pretend Space has it, its
 * preview drawn; with
 * `selecting`, everything on the canvas is selected first.
 */
export async function openExport(page: Page, theme: Theme, selecting = false) {
  await openApp(page, theme);
  await openPage(page, CANVAS_PAGE);
  await menu(page, 'view.canvas');
  await expect(canvasHost(page)).toBeVisible();
  if (selecting) {
    // Keys reach the canvas once it has been clicked, as a person's would.
    await clickScene(page, { x: 900, y: 560 });
    await menu(page, 'edit.selectAll');
  }
  await menu(page, 'file.export');
  const dialog = openDialog(page);
  await expect(dialog.locator('.bava-export-preview svg')).toBeVisible();
  return dialog;
}

/** Exports through the dialog, as the person sets it up. */
export async function exportAs(page: Page, format: 'PNG' | 'SVG', settings: { scale?: string; background?: boolean; dark?: boolean; onlySelected?: boolean } = {}) {
  await menu(page, settings.onlySelected ? 'canvas.exportSelection' : 'file.export');
  const dialog = openDialog(page);
  await expect(dialog).toBeVisible();
  const toggle = async (name: string, on: boolean | undefined) => {
    if (on === undefined) return;
    const control = dialog.getByRole('checkbox', { name });
    if ((await control.isChecked()) !== on) await dialog.getByText(name, { exact: true }).click();
    await expect(control).toBeChecked({ checked: on });
  };
  await toggle('Background', settings.background);
  await toggle('Dark mode', settings.dark);
  if (settings.scale) await dialog.getByText(settings.scale, { exact: true }).click();
  const before = (await exportsSoFar(page)).length;
  await dialog.getByRole('button', { name: format, exact: true }).click();
  await expect.poll(async () => (await exportsSoFar(page)).length).toBe(before + 1);
  return (await exportsSoFar(page)).at(-1)!;
}

/** The canvas page closed and opened again from its file, nudged there and back so the next save rewrites it. */
export async function reopened(page: Page) {
  const before = await saved(page);
  await openPage(page, 'Engineering/Blocks.md');
  await openPage(page, CANVAS_PAGE);
  await menu(page, 'view.canvas');
  await expect(canvasHost(page)).toBeVisible();
  await clickScene(page, { x: 900, y: 560 });
  await menu(page, 'edit.selectAll');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  const after = await saved(page);
  return { before, after };
}

// ---- the component gallery ---------------------------------------------------------

/** A component's name as its references name it: ToolRail is tool-rail. */
export const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * Opens the component gallery on one component (`src/components/<name>.svelte`),
 * in a theme, with one of the set-ups its demo knows.
 */
export async function openGallery(page: Page, component: string, theme: Theme, variant = '') {
  // The same fixed clock as the app's walks: a calendar and the Trash read the date.
  await page.clock.install({ time: new Date('2026-09-27T12:00:00Z') });
  const query = new URLSearchParams({ c: component, theme });
  if (variant) query.set('v', variant);
  await page.goto(`/tests/harness/gallery.html?${query}`);
  // The first page a fresh server serves is slow to build; later ones are quick.
  await expect(page.locator(`[data-gallery="${component}"]`)).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** Everything the gallery shows of a component: each of its cells. */
export const stage = (page: Page) => page.locator('.gallery');

/** One cell of the gallery, by the name over it. */
export const cell = (page: Page, name: string) => page.locator(`[data-cell="${name}"]`);

/** The name a gallery picture is kept under: gallery/<component>--<state>--<theme>. */
export const componentShot = (component: string, state: string, theme: Theme) => shot('components', kebab(component), state, theme);

/** Whether the pointer is over `target`, as the page reads it. */
export const hovered = (target: Locator) => target.evaluate((element) => element.matches(':hover'));

/**
 * Moves the keyboard's focus onto `target` with Tab, as a person reaching it
 * would, so it shows the ring a click does not. Each press moves one stop
 * along the page; a page with fewer stops than `limit` before it is reached
 * fails on the focus check.
 */
export async function tabTo(page: Page, target: Locator, limit = 40) {
  for (let i = 0; i < limit && !(await target.evaluate((element) => element === document.activeElement)); i += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

/** The pointer held down on `target`'s middle, for a picture of it pressed; the walk releases it. */
export async function pressOn(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => target.evaluate((element) => element.matches(':active'))).toBe(true);
}
