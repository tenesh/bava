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
