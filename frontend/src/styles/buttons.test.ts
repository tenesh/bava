import { describe, expect, it } from 'vitest';
import { compile } from 'sass';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { resolve } from 'node:path';

const css = compile(resolve(__dirname, 'index.scss'), { style: 'expanded' }).css;
const rule = (selector: string) => {
  const at = css.indexOf(`${selector} {`);
  return at < 0 ? null : css.slice(at, css.indexOf('}', at) + 1);
};

describe('buttons', () => {
  it('have hover and pressed colours in each theme', () => {
    for (const name of ['control-hover', 'control-active', 'accent-hover', 'accent-active', 'danger-active']) {
      expect((css.match(new RegExp(`--color-${name}:`, 'g')) ?? []).length, name).toBe(2);
    }
  });

  it('point, and refuse when disabled', () => {
    expect(css).toMatch(/button,[^{]*\[role=["']?button["']?\][^{]*\{[^}]*cursor:\s*pointer/);
    expect(css).toMatch(/:disabled,[^{]*\[aria-disabled=["']?true["']?\][^{]*\{[^}]*cursor:\s*not-allowed/);
  });

  it('share one style with every state', () => {
    expect(rule('.bava-button:hover:not(:disabled)')).toContain('--color-control-hover');
    expect(rule('.bava-button:active:not(:disabled)')).toContain('--color-control-active');
    expect(rule('.bava-button:disabled')).toContain('--opacity-disabled');
    expect(rule('.bava-button:focus-visible')).toContain('--color-focus-ring');
    expect(rule('.bava-button.primary:hover:not(:disabled)')).toContain('--color-accent-hover');
    expect(rule('.bava-button.primary:active:not(:disabled)')).toContain('--color-accent-active');
    expect(rule('.bava-button.danger:active:not(:disabled)')).toContain('--color-danger-active');
    expect(rule('.bava-icon-button:hover:not(:disabled)')).toContain('--color-control-hover');
    expect(rule('.bava-icon-button:active:not(:disabled)')).toContain('--color-control-active');
  });
});

// Every button in the app answers the pointer: it either uses the shared
// style, or its own component styles its hover and pressed states.
describe('every button in a component', () => {
  // From this file's place, not the working folder.
  const files = globSync('**/*.svelte', { cwd: resolve(__dirname, '..') }).map((file) => resolve(__dirname, '..', file));
  const cases = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    // A component's own styles, and the shared ones in styles/.
    const style = (source.split('<style>')[1] ?? '') + css;
    const classes = [...source.matchAll(/<button\b[^>]*?\bclass="([^"{]+)"/g)].map((m) => m[1].trim().split(/\s+/)[0]);
    return [...new Set(classes)]
      .filter((name) => !name.startsWith('bava-button') && !name.startsWith('bava-icon-button'))
      .map((name) => ({ file, name, style }));
  });

  it.each(cases)('$file .$name has hover and pressed states', ({ name, style }) => {
    const escaped = name.replace(/[-]/g, '\\-');
    expect(style, 'no :hover').toMatch(new RegExp(`\\.${escaped}[^{,]*:hover`));
    expect(style, 'no :active').toMatch(new RegExp(`\\.${escaped}[^{,]*:active`));
  });
});
