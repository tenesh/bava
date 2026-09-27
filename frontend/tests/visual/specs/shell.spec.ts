import { expect, test } from '@playwright/test';
import { THEMES, menu, openApp, openPage, openSpace, shot } from './helpers';

for (const theme of THEMES) {
  test.describe(`the main window, ${theme}`, () => {
    test('a Space open, a page in Both', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing', 'Marketing/Launch plan.md');
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'both', theme));
    });

    test('the Document view', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Marketing', 'Marketing/Launch plan.md');
      await menu(page, 'view.document');
      // The editor follows the theme: its gutter and current line are no
      // lighter than the page in dark, no darker in light.
      const shades = await page.evaluate(() => {
        const lum = (el: Element | null) => {
          const [r, g, b] = (getComputedStyle(el!).backgroundColor.match(/[\d.]+/g) ?? ['0', '0', '0']).map(Number);
          const alpha = Number(getComputedStyle(el!).backgroundColor.match(/[\d.]+/g)?.[3] ?? 1);
          return { lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255, alpha };
        };
        const parts = ['.cm-gutters', '.cm-activeLine', '.cm-activeLineGutter'];
        return parts
          .map((part) => document.querySelector(`[data-side="document"] ${part}`))
          .filter((el): el is Element => el !== null)
          .map((el) => ({ part: el.className, ...lum(el) }));
      });
      expect(shades.length).toBeGreaterThan(0);
      for (const shade of shades) {
        if (shade.alpha > 0.5) expect(theme === 'dark' ? shade.lum < 0.35 : shade.lum > 0.65).toBe(true);
      }
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'document', theme));
    });

    test('the Canvas view, with shapes on the dot grid', async ({ page }) => {
      await openApp(page, theme);
      await openPage(page, 'Engineering', 'Engineering/Architecture.md');
      await menu(page, 'view.canvas');
      // Nodes counts what is on the canvas: three shapes and an arrow.
      await expect(page.locator('footer')).toContainText('Nodes 4');
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'canvas', theme));
    });

    test('no page open in a Space', async ({ page }) => {
      await openApp(page, theme);
      await openSpace(page);
      await expect(page).toHaveScreenshot(shot('shell', 'main', 'no-page', theme));
    });
  });
}
