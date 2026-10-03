import { describe, expect, it } from 'vitest';
import { compile } from 'sass';
import { fileURLToPath } from 'node:url';
import { RUN_KINDS } from '../canvas/code/highlight';

// The canvas's code editor and the page's code blocks colour their text with
// one class per kind the highlighter marks. The stylesheets list those kinds
// by hand, so a kind added to the highlighter without its rule would show in
// the plain colour.
describe('the syntax colours', () => {
  const css = compile(fileURLToPath(new URL('./index.scss', import.meta.url)), { style: 'expanded' }).css;
  const marked = RUN_KINDS.filter((kind) => kind !== 'plain');

  it.each(['.bava-code-editor', '.bava-doc'])('colour every kind the highlighter marks, in %s', (scope) => {
    const missing = marked.filter((kind) => !css.includes(`${scope} .syntax-${kind} {\n  color: var(--syntax-${kind});`));
    expect(missing).toEqual([]);
  });
});
