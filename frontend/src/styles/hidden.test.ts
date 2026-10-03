import { describe, expect, it } from 'vitest';
import { compile } from 'sass';
import { fileURLToPath } from 'node:url';

// Ark keeps a closed dialog, menu or popover in the page with the `hidden`
// attribute. A component that sets `display` on one of those parts would
// otherwise override it and show every closed dialog at once, covering the
// window. The global rule keeps `hidden` meaning hidden, whatever a
// component's own display is.
describe('the hidden attribute', () => {
  const css = compile(fileURLToPath(new URL('./index.scss', import.meta.url)), { style: 'expanded' }).css;

  it('always hides, even over a component\'s own display', () => {
    expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  });
});
