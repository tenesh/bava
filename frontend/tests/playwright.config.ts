import { defineConfig } from '@playwright/test';

// The browser tests: visual regression (screenshots only) and integration
// (behaviour in a real browser, no screenshots). Run through
// tests/scripts/browser.sh, inside the pinned container, so a screenshot here
// matches one taken on CI pixel for pixel.
export default defineConfig({
  projects: [
    { name: 'visual', testDir: './visual' },
    { name: 'integration', testDir: './integration' },
  ],
  outputDir: './.results/output',
  snapshotPathTemplate: '{testDir}/../../../testdata/visual/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  // The orphan list: references a full run never compared, to be deleted.
  reporter: [['list'], ['html', { outputFolder: './.results/report', open: 'never' }], ['./harness/orphans.ts']],
  expect: {
    // Near exact: the default tolerance passes a pixel within a fifth of its
    // colour, enough to hide a changed icon or token. 0.02 passes only the few
    // steps of edge smoothing that differ from run to run.
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixels: 0, threshold: 0.02 },
  },
  use: {
    browserName: 'webkit',
    baseURL: 'http://127.0.0.1:9300',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'en-GB',
    timezoneId: 'UTC',
  },
  webServer: {
    command: 'npx vite --config vite.visual.config.ts',
    cwd: '..',
    url: 'http://127.0.0.1:9300/tests/harness/index.html',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
