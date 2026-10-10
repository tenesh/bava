import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Section labels (pane headers, settings and dialog groups, shortcut
// headings) are small tracked capitals in the mono face. A rule that tracks
// a label but leaves its face to inheritance draws it in the UI face, so
// every rule using the label tracking must name the label face too.

const src = fileURLToPath(new URL('..', import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(svelte|scss)$/.test(name) ? [path] : [];
  });
}

// The innermost rule bodies: in Svelte styles and SCSS alike, the
// declarations of a rule sit between braces with none inside.
function bodies(text: string): string[] {
  return [...text.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
}

describe('section labels', () => {
  it('set every tracked label in the label face', () => {
    const offenders: string[] = [];
    for (const path of files(src)) {
      if (path.includes(`${join('styles', 'tokens')}`)) continue;
      for (const body of bodies(readFileSync(path, 'utf8'))) {
        if (body.includes('var(--tracking-label)') && !body.includes('font-family: var(--font-label)')) {
          offenders.push(relative(src, path));
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});
