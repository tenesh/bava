import { describe, expect, it } from 'vitest';
import { compile } from 'sass';
import { fileURLToPath } from 'node:url';

// Each field (find, a link, a search, a name) draws its placeholder in the
// one token, so a placeholder never takes the browser's own grey.
describe('field placeholders', () => {
  const css = compile(fileURLToPath(new URL('./index.scss', import.meta.url)), { style: 'expanded' }).css;

  it('take the placeholder colour in every input and text area', () => {
    expect(css).toMatch(/input::placeholder,\s*textarea::placeholder\s*\{[^}]*color:\s*var\(--color-placeholder\)/);
  });
});
