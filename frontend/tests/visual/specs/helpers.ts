import { expect, type Page } from '@playwright/test';

export type Theme = 'light' | 'dark';
export const THEMES: Theme[] = ['light', 'dark'];

type Harness = { __bava: { menu(id: string): void }; _wails: { dispatchWailsEvent(event: { name: string; data: unknown }): void } };

/** Opens the app on the harness page, in a theme, and waits for it to settle. */
export async function openApp(page: Page, theme: Theme, storage: Record<string, string> = {}) {
  await page.addInitScript(
    ([seed, chosen]) => {
      for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
      localStorage.setItem('bava.theme', chosen);
    },
    [storage, theme] as const,
  );
  // A fixed clock: the Trash says "Today" and dates, which would otherwise
  // change the pictures with the calendar.
  await page.clock.install({ time: new Date('2026-09-27T12:00:00Z') });
  await page.goto('/tests/visual/harness/index.html');
  await expect(page.locator('[data-part="splash"]')).toHaveCount(0, { timeout: 15_000 });
  // The first page a fresh server serves is slow to build; later ones are quick.
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** A native menu command, as Go delivers it. */
export async function menu(page: Page, id: string) {
  await page.evaluate((command) => (window as unknown as Harness).__bava.menu(command), id);
}

/** Opens the seeded Space, as Open Space would. */
export async function openSpace(page: Page) {
  await menu(page, 'file.openSpace');
  await expect(page.locator('[data-path="Roadmap.md"]')).toBeVisible();
}

/** The name a reference is kept under: area/screen--state--theme. */
export const shot = (area: string, screen: string, state: string, theme: Theme) => [area, `${screen}--${state}--${theme}.png`];

/** Nothing covers the window: no dialog shows unless one was opened. */
export async function expectNothingCovering(page: Page) {
  for (const selector of ['.bava-dialog-content', '.bava-dialog-backdrop', '.bava-menu', '.bava-control-popover']) {
    await expect(page.locator(selector).filter({ visible: true }), `${selector} shows with nothing opened`).toHaveCount(0);
  }
}

/** An event from Go, such as an unexpected error. */
export async function emit(page: Page, name: string, data: unknown) {
  await page.evaluate(([event, payload]) => (window as unknown as Harness)._wails.dispatchWailsEvent({ name: event, data: payload }), [name, data] as const);
}

/** Opens a page from the tree, opening its folder first. */
export async function openPage(page: Page, folder: string, path: string) {
  await openSpace(page);
  const row = page.locator(`[data-path="${path}"]`);
  if (!(await row.isVisible())) await page.locator(`[data-path="${folder}"]`).click();
  await row.click();
  await expect(page.locator('header')).toContainText(path.split('/').pop()!.replace(/\.md$/, ''));
}

/** The dialog that is open now. */
export const openDialog = (page: Page) => page.locator('.bava-dialog-content').filter({ visible: true });

// ---- the canvas ----------------------------------------------------------

/** The pretend Space's folder, as the fixtures root it. */
export const SPACE = '/Users/you/Documents/Acme Product';

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
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  await openPage(page, folder, path);
  await menu(page, 'view.canvas');
  await expect(canvasHost(page)).toBeVisible();
}

/** The canvas's drawing surface. */
export const canvasHost = (page: Page) => page.locator("[data-side='canvas'] .konvajs-content");

/** Saves the page, then the scene as the file now holds it. */
export async function savedScene(page: Page, path: string) {
  await menu(page, 'file.save');
  await expect(page.locator('header .state')).toHaveText('saved');
  return page.evaluate(([root, at]) => (window as unknown as CanvasHarness).__bava.fakes.harness.scene(root, at), [SPACE, path] as const);
}

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

/** Where a point of the scene is on screen, at a zoom reached by `zoomSteps` from a fresh page. */
export async function onScreen(page: Page, scene: { x: number; y: number }, zoom = 1) {
  const box = (await canvasHost(page).boundingBox())!;
  const centre = { x: box.width / 2, y: box.height / 2 };
  return { x: box.x + scene.x * zoom + centre.x * (1 - zoom), y: box.y + scene.y * zoom + centre.y * (1 - zoom) };
}

/**
 * Pans, by a wheel in pixels, so a point of the scene sits just right of the
 * tool rail, at a zoom reached by `zoomSteps` from a fresh page.
 */
export async function bringToCorner(page: Page, scene: { x: number; y: number }, zoom: number) {
  const box = (await canvasHost(page).boundingBox())!;
  const now = await onScreen(page, scene, zoom);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  // The wheel pans the other way to its delta.
  await page.mouse.wheel(now.x - (box.x + 80), now.y - (box.y + 20));
}
