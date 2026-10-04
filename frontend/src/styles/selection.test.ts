import { describe, expect, it } from 'vitest';
import { compile } from 'sass';
import { fileURLToPath } from 'node:url';

// Selected text takes Bava's selection colour, so it looks the same on every
// platform and whether or not the window is active; the system highlight
// changes with both.
describe('selected text', () => {
  const css = compile(fileURLToPath(new URL('./index.scss', import.meta.url)), { style: 'expanded' }).css;

  it('is drawn in the selection colour', () => {
    expect(css).toMatch(/(^|\n)::selection\s*\{[^}]*background:\s*var\(--color-selection\)/);
  });
});

