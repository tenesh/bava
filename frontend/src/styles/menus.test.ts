import { describe, expect, it } from 'vitest';
import { compile } from 'sass';
import { fileURLToPath } from 'node:url';

// The context menu, the `/` menu and the Space menu share one look. It lives
// in the app's stylesheet, so a menu never depends on another component's
// styles having loaded.
describe('the shared menu styles', () => {
  const css = compile(fileURLToPath(new URL('./index.scss', import.meta.url)), { style: 'expanded' }).css;

  it.each(['.bava-menu', '.bava-menu-item', '.bava-menu-item[data-highlighted]', '.bava-menu-label', '.bava-menu-separator'])(
    'are in the app stylesheet: %s',
    (selector) => {
      expect(css).toContain(`${selector} {`);
    },
  );
});
