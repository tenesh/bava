import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { forceStates, forced } from './force-states';

// A sheet shows a component hovered, focused and pressed side by side, which
// one pointer and one focus cannot do: in the test page, an element marked
// `data-force` takes the look of that state.
describe('forced', () => {
  it('lets a marked element take the hover, focus and pressed looks', () => {
    expect(forced('.button:hover')).toBe('.button[data-force~="hover"]');
    expect(forced('.row:focus-visible .name')).toBe('.row[data-force~="focus"] .name');
    expect(forced('.tab:active:not(:disabled)')).toBe('.tab[data-force~="active"]:not(:disabled)');
  });

  // `:not(:hover)` is every element not under the pointer: its forced copy
  // would match every element at all, hover or not.
  it('leaves a state inside :not() alone', () => {
    expect(forced('.block:not(:hover) .copy')).toBeNull();
    expect(forced('.row:hover:not(:focus-visible)')).toBe('.row[data-force~="hover"]:not(:focus-visible)');
    expect(forced('.a:not(:is(.b:hover, .c)) .d:hover')).toBe('.a:not(:is(.b:hover, .c)) .d[data-force~="hover"]');
  });

  it('leaves a selector with no such state alone', () => {
    expect(forced('.button[aria-pressed="true"]')).toBeNull();
    expect(forced('input:focus')).toBeNull();
  });
});

describe('forceStates', () => {
  it('adds the marked form beside each selector that has a state, once', () => {
    const rules = [{ selectors: ['.a:hover', '.b'] }, { selectors: ['.c'] }];
    forceStates.Once({ walkRules: (visit: (rule: { selectors: string[] }) => void) => rules.forEach(visit) });
    expect(rules[0].selectors).toEqual(['.a:hover', '.b', '.a[data-force~="hover"]']);
    expect(rules[1].selectors).toEqual(['.c']);
  });

  it('is part of the test page only, never the app', () => {
    const app = readFileSync(fileURLToPath(new URL('../../vite.config.ts', import.meta.url)), 'utf8');
    const visual = readFileSync(fileURLToPath(new URL('../../vite.visual.config.ts', import.meta.url)), 'utf8');
    expect(app).not.toContain('force-states');
    expect(visual).toContain('force-states');
  });
});
