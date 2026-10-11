import { describe, expect, it } from 'vitest';
import { bundleFrom } from './bundle';

const GLOBAL = `
:root { --color-surface: #ffffff; }
:root[data-theme=dark] { --color-surface: #0a0a0a; }
.bava-button { color: var(--color-text-secondary); }
:root[data-theme=dark] .bava-button { color: var(--color-text-primary); }
`;

const START = `<script lang="ts">let x = 1;</script>
<main class="start"></main>
<style>
  /* A comment. */
  .start { display: flex; }
  .start :global(.bava-button) { height: var(--size-toolbar); }
  @keyframes -global-bava-sweep { from { opacity: 0; } to { opacity: 1; } }
</style>`;

describe('bundleFrom', () => {
  const bundle = bundleFrom(GLOBAL, [{ name: 'StartScreen', source: START, path: 'frontend/src/components/StartScreen.svelte' }], ':root { --size-row: 26px; }');

  it('keeps the shared styles and drops the blocks that only declare tokens', () => {
    expect(bundle.css).toContain('.bava-button { color: var(--color-text-secondary); }');
    expect(bundle.css).not.toContain('--color-surface: #ffffff');
  });

  it('turns the app-wide dark selector into the theme attribute any element can carry', () => {
    expect(bundle.css).toContain('[data-theme="dark"] .bava-button');
    expect(bundle.css).not.toContain(':root[data-theme=dark]');
  });

  it("nests a component's own styles under its wrapper, which takes no box", () => {
    expect(bundle.wrappers).toEqual(['bv-start-screen']);
    expect(bundle.css).toContain('.bv-start-screen { display: contents; }');
    expect(bundle.css).toMatch(/\.bv-start-screen \{\s*\.start \{ display: flex; \}/);
  });

  it('unwraps global selectors and lifts keyframes out of the nesting', () => {
    expect(bundle.css).toContain('.start .bava-button { height: var(--size-toolbar); }');
    expect(bundle.css).toContain('@keyframes bava-sweep');
    expect(bundle.css).not.toMatch(/\.bv-start-screen \{[^}]*@keyframes/);
  });

  it('carries the token remainder first and no comments from the sources', () => {
    expect(bundle.css.startsWith(':root { --size-row: 26px; }')).toBe(true);
    expect(bundle.css).not.toContain('A comment.');
  });
});
