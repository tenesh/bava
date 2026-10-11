import { describe, expect, it } from 'vitest';
import { tokensFrom } from './tokens';

const CSS = `
:root {
  color-scheme: light;
  --color-surface: #ffffff;
  --color-mark-tile: #131416;
  --swatch-blue-fill: #e6eef7;
  --color-diagram-node-fill: #ffffff;
  --space-1: 4px;
  --radius-sm: 3px;
  --text-body: 13px;
  --size-row: 26px;
  --shadow-floating: 0 8px 24px rgba(10, 10, 10, 0.12);
  --shadow-outlined: inset 0 0 0 var(--border-width) var(--color-border-strong);
  --font-ui: 'Geist', system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
}
:root[data-theme=dark] {
  color-scheme: dark;
  --color-surface: #0a0a0a;
  --color-mark-tile: transparent;
  --opacity-mark-faded: 0.32;
}
`;

describe('tokensFrom', () => {
  it('gives a colour its value in each theme', () => {
    const surface = tokensFrom(CSS).json.color.tokens.find((t) => t.name === 'color-surface');
    expect(surface?.value).toEqual({ light: '#ffffff', dark: '#0a0a0a' });
  });

  it('writes a transparent colour as its exact value, which the format can read', () => {
    const tile = tokensFrom(CSS).json.color.tokens.find((t) => t.name === 'color-mark-tile');
    expect(tile?.value).toEqual({ light: '#131416', dark: 'rgba(0, 0, 0, 0)' });
  });

  it("gives a diagram colour a note naming its part", () => {
    const node = tokensFrom(CSS).json.color.tokens.find((t) => t.name === 'color-diagram-node-fill');
    expect(node?.usage).toBe("A diagram's node fill.");
  });

  it('files spacing, radii, sizes of type and shadows by their names', () => {
    const { json } = tokensFrom(CSS);
    expect(json.spacing.tokens.map((t) => t.name)).toContain('space-1');
    expect(json.radius.tokens.map((t) => t.name)).toEqual(['radius-sm']);
    expect(json.fontSize.tokens.map((t) => t.name)).toEqual(['text-body']);
    expect(json.shadow.tokens.map((t) => t.name)).toEqual(['shadow-floating']);
  });

  it('keeps what the format cannot hold for the stylesheet, per theme', () => {
    const { remainder } = tokensFrom(CSS);
    expect(remainder).toContain('--size-row: 26px;');
    expect(remainder).toContain('--shadow-outlined: inset 0 0 0 var(--border-width) var(--color-border-strong);');
    expect(remainder).toMatch(/\[data-theme="dark"\] \{[^}]*--opacity-mark-faded: 0\.32;/);
    expect(remainder).not.toContain('--color-surface');
  });

  it('names type styles apart from the class names components use', () => {
    const styles = tokensFrom(CSS).json.type.groups.flatMap((g) => g.styles.map((s) => s.name));
    expect(styles.length).toBeGreaterThan(0);
    for (const name of styles) expect(name).toMatch(/^type-/);
  });

  it('declares every token in tokens.css, dark values under the dark theme', () => {
    const { css } = tokensFrom(CSS);
    expect(css.split('\n')[0]).toBe('/* Bava Design System — generated from tokens.json */');
    expect(css).toMatch(/\[data-theme="dark"\] \{[^}]*--color-surface: #0a0a0a;/);
    expect(css).toContain('--space-1: 4px;');
    expect(css).toContain("@font-face { font-family: 'Geist Mono'");
  });
});
