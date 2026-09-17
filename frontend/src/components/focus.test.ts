import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Desktop users keyboard far more than web users and notice immediately when
// focus is invisible. This catches a component shipping with interactive
// elements and no focus treatment at all. It cannot judge whether the ring is
// *good*, which is what the manual pass is for.

const COMPONENT_DIRS = ['src/components', 'src/shell', 'src/settings'];

function componentFiles(): string[] {
  const out: string[] = [];
  for (const dir of COMPONENT_DIRS) {
    for (const entry of readdirSync(dir)) {
      if (entry.endsWith('.svelte')) out.push(join(dir, entry));
    }
  }
  return out;
}

/** Elements a keyboard can land on. */
const INTERACTIVE = /<button|<input|<a\s|role="radio"|role="button"|SegmentGroup\.Item|Splitter\.ResizeTrigger/;

describe('focus treatment', () => {
  it('gives every component with interactive elements a focus rule', () => {
    const missing: string[] = [];
    for (const file of componentFiles()) {
      const source = readFileSync(file, 'utf8');
      if (!INTERACTIVE.test(source)) continue;
      if (!source.includes(':focus')) missing.push(file);
    }
    expect(missing).toEqual([]);
  });

  it('builds focus rings from the focus tokens, not ad-hoc colours', () => {
    const wrong: string[] = [];
    for (const file of componentFiles()) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes(':focus')) continue;
      if (!source.includes('--color-focus-ring')) wrong.push(file);
    }
    expect(wrong).toEqual([]);
  });

  it('checks a meaningful number of components', () => {
    expect(componentFiles().length).toBeGreaterThan(4);
  });
});
