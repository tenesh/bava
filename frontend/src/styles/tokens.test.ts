import { describe, expect, it } from 'vitest';
import { compile } from 'sass';
import { fileURLToPath } from 'node:url';

// Compiled directly rather than read from dist/: the production build minifies
// #ffffff to #fff, and a token test that depends on minifier behaviour tests
// the wrong thing.
const css = compile(fileURLToPath(new URL('./index.scss', import.meta.url)), {
  style: 'expanded',
}).css;

// Every partial emits its own rule, so a selector appears many times and all
// of its blocks have to be collected — reading only the first silently tests
// one file and passes.
function block(selector: string): string {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(`${selector} {`, from);
    if (start === -1) break;
    const end = css.indexOf('}', start);
    out.push(css.slice(start, end));
    from = end;
  }
  return out.join('\n');
}

function propsIn(selector: string): string[] {
  return [...block(selector).matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]);
}

// Sass emits the attribute selector unquoted regardless of how it is written.
const light = propsIn(':root');
const dark = propsIn(':root[data-theme=dark]');

describe('token emission', () => {
  it('emits tokens on :root', () => {
    expect(light.length).toBeGreaterThan(50);
  });

  // The most likely mistake in this milestone: adding a light value and
  // forgetting the dark one. Every colour token must exist in both themes.
  it('defines every colour token in both themes', () => {
    const lightColours = light.filter((p) => p.startsWith('--color-'));
    const missing = lightColours.filter((p) => !dark.includes(p));
    expect(missing).toEqual([]);
    expect(lightColours.length).toBeGreaterThan(30);
  });

  it('does not define a dark colour token that has no light counterpart', () => {
    const orphans = dark.filter((p) => p.startsWith('--color-') && !light.includes(p));
    expect(orphans).toEqual([]);
  });

  // Names come from the design sheet. Pinning them means a rename is a
  // deliberate act rather than a typo that silently breaks a component.
  it('matches the design sheet token names', () => {
    for (const name of [
      'surface',
      'surface-raised',
      'surface-sunken',
      'surface-overlay',
      'surface-nav',
      'border-subtle',
      'border-strong',
      'border-hairline',
      'text-primary',
      'text-secondary',
      'text-muted',
      'text-faint',
      'accent',
      'accent-contrast',
      'accent-subtle',
      'selection',
      'focus-ring',
      'danger',
      'danger-subtle',
      'ok',
      'backdrop',
      'canvas-bg',
      'canvas-dot',
      'note-fill',
      'note-border',
      'diagram-bg',
      'diagram-container-fill',
      'diagram-node-fill',
      'diagram-node-stroke',
      'diagram-label',
      'diagram-edge',
      'diagram-edge-label',
    ]) {
      expect(light, `--color-${name} missing`).toContain(`--color-${name}`);
    }
  });

  it('carries the design palette values verbatim', () => {
    expect(block(':root')).toContain('--color-surface: #f7f7f5');
    expect(block(':root')).toContain('--color-accent: #2f6ba3');
    expect(block(':root[data-theme=dark]')).toContain('--color-surface: #191a1c');
    expect(block(':root[data-theme=dark]')).toContain('--color-accent: #7fabd9');
  });

  it('emits the non-colour scales', () => {
    for (const p of [
      '--space-1',
      '--space-12',
      '--size-titlebar',
      '--text-body',
      '--radius-md',
      '--shadow-overlay',
      '--duration-base',
      '--z-portal',
    ]) {
      expect(light, `${p} missing`).toContain(p);
    }
  });

  // Ark ships no z-index of its own; portalled content painted below ordinary
  // chrome in the spike. This is the token that fixes it, so the ordering is
  // asserted rather than left to a reader's care.
  it('stacks portals above chrome', () => {
    const z = (name: string) => Number(block(':root').match(new RegExp(`--z-${name}: (\\d+)`))![1]);
    expect(z('portal')).toBeGreaterThan(z('floating'));
    expect(z('floating')).toBeGreaterThan(z('chrome'));
    expect(z('toast')).toBeGreaterThan(z('portal'));
  });

  it('zeroes durations under prefers-reduced-motion', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});

describe('type tokens', () => {
  // Fonts are bundled, not assumed present. A desktop app cannot rely on a
  // system font, and the same rule is what keeps text measurement consistent
  // across platforms.
  it('declares the bundled faces', () => {
    // Sass normalises single quotes to double in its output, so the assertion
    // is quote-agnostic rather than matching how the source happens to be
    // written.
    expect(css).toMatch(/font-family:\s*["']Geist["']/);
    expect(css).toMatch(/font-family:\s*["']Geist Mono["']/);
    expect((css.match(/@font-face/g) ?? []).length).toBe(3);
  });

  it('references the bundled files rather than a remote source', () => {
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u, `${u} is not a local font`).toMatch(/^['"]?\/fonts\//);
    }
  });

  it('exposes both family stacks as tokens', () => {
    expect(light).toContain('--font-ui');
    expect(light).toContain('--font-mono');
  });
});
