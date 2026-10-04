import { test } from '@playwright/test';
import { expectNothingCovering, openApp } from '../helpers';

// Closed dialogs once covered the window at launch with every logic test
// green: nothing may show until something is opened.
test('nothing covers the window at launch', async ({ page }) => {
  await openApp(page, 'light');
  await expectNothingCovering(page);
});
